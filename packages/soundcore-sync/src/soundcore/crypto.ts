import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** SHA256(utf8) — used to derive 16-byte AES key for OpenAPI payloads when CC_HEX is not raw 16-byte hex */
export function sha256Utf8(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** OpenAPI HMAC: key = CC_HEX string as UTF-8 (do not Hex.parse) — DESIGN.md §5.2.1 */
export function openApiHmacSignature(ccHex: string, message: string): string {
  return createHmac("sha256", ccHex).update(message, "utf8").digest("hex");
}

/** AES-128-CBC key for OpenAPI client_public_key encryption (bundle may differ; override via env if needed) */
export function openapiAesKeyFromCcHex(ccHex: string): Buffer {
  return sha256Utf8(ccHex).subarray(0, 16);
}

export function aesCbcPkcs7Encrypt(key: Buffer, iv: Buffer, plain: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(plain), cipher.final()]);
}

/** `data` buffer: IV (16) || ciphertext */
export function aesCbcPkcs7DecryptWithIvPrepended(key: Buffer, data: Buffer): Buffer {
  const iv = data.subarray(0, 16);
  const ct = data.subarray(16);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function buildClientPublicKeyB64(clientPubKeyHex: string, ccHex: string): string {
  const key = openapiAesKeyFromCcHex(ccHex);
  const iv = randomBytes(16);
  const enc = aesCbcPkcs7Encrypt(key, iv, Buffer.from(clientPubKeyHex, "utf8"));
  return Buffer.concat([iv, enc]).toString("base64");
}

export function decryptOpenApiDataB64(b64: string, ccHex: string): string {
  const raw = Buffer.from(b64, "base64");
  const key = openapiAesKeyFromCcHex(ccHex);
  return aesCbcPkcs7DecryptWithIvPrepended(key, raw).toString("utf8");
}

export function wrapPlaintextToBodyB64(plainUtf8: string, aesKey: Buffer): string {
  const iv = randomBytes(16);
  const enc = aesCbcPkcs7Encrypt(aesKey, iv, Buffer.from(plainUtf8, "utf8"));
  return Buffer.concat([iv, enc]).toString("base64");
}

export function unwrapBodyB64ToPlain(b64: string, aesKey: Buffer): string {
  const raw = Buffer.from(b64, "base64");
  return aesCbcPkcs7DecryptWithIvPrepended(aesKey, raw).toString("utf8");
}

/** HMAC for Passport/App wrapped calls — key = shareKeyHex32 UTF-8 string (DESIGN.md §5.3) */
export function wrappedApiHmac(shareKeyHex32: string, ts: string, once: string, bodyB64: string): string {
  const message = `${ts}+${once}+${bodyB64}`;
  return createHmac("sha256", shareKeyHex32).update(message, "utf8").digest("hex");
}

export function createPrime256v1Ecdh(): ReturnType<typeof createECDH> {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return ecdh;
}

export function computeShareKeyHex32(clientEcdh: ReturnType<typeof createECDH>, serverPublicKeyHex: string): string {
  const secretHex = clientEcdh.computeSecret(serverPublicKeyHex, "hex", "hex") as string;
  return secretHex.slice(0, 32);
}

/** Password field for login inner JSON — ECDH with fixed login server pub, then AES-CBC (DESIGN.md §6.3) */
export function encryptPasswordToLoginField(password: string, loginServerPubHex: string): string {
  const ephem = createECDH("prime256v1");
  ephem.generateKeys();
  const secretHex = ephem.computeSecret(loginServerPubHex, "hex", "hex") as string;
  const key = Buffer.from(secretHex.slice(0, 32), "hex");
  const iv = randomBytes(16);
  const enc = aesCbcPkcs7Encrypt(key, iv, Buffer.from(password, "utf8"));
  return Buffer.concat([iv, enc]).toString("base64");
}

export function md5Hex(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
