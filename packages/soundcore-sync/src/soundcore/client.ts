import axios, { type AxiosResponse } from "axios";
import type { SoundcoreApiEnvelope } from "./types.js";
import {
  decryptOpenApiDataB64,
  md5Hex,
  openApiHmacSignature,
  wrapPlaintextToBodyB64,
  unwrapBodyB64ToPlain,
  wrappedApiHmac,
} from "./crypto.js";
import { OPENAPI_KEY_EXCHANGE_PATH, SOUNDCORE_APP_BASE, SOUNDCORE_OPENAPI_BASE, SOUNDCORE_PASSPORT_BASE } from "./constants.js";
import { logger } from "../logger.js";

export interface EcdhSessionMaterial {
  shareKeyHex32: string;
  aesKey: Buffer;
  keyIdent: string;
  clientPubHex: string;
  openudid: string;
  authToken: string;
  userId: string;
}

function pickHeader(res: AxiosResponse, names: string[]): string {
  for (const n of names) {
    const v = res.headers[n.toLowerCase()] ?? res.headers[n];
    if (typeof v === "string" && v) return v;
    if (Array.isArray(v) && v[0]) return v[0];
  }
  return "";
}

export async function postOpenApiKeyExchange(
  ccHex: string,
  clientPublicKeyB64: string,
): Promise<{ keyIdent: string; serverPublicKeyHex: string; raw: unknown }> {
  const ts = Date.now();
  const once = `${ts}-${Math.random().toString(36).slice(2, 14)}`;
  const sig = openApiHmacSignature(ccHex, `${ts}+${once}+${clientPublicKeyB64}`);
  const url = `${SOUNDCORE_OPENAPI_BASE}${OPENAPI_KEY_EXCHANGE_PATH}`;
  const res = await axios.post(
    url,
    { client_public_key: clientPublicKeyB64 },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Signature": sig,
        "X-Request-Ts": String(ts),
        "X-Request-Once": once,
        "App-Name": "soundcore_app",
        "App-name": "soundcore_app",
        "X-Encryption-Info": "algo_ecdh",
        "Model-type": "WEB",
        "Model-Type": "WEB",
      },
      validateStatus: () => true,
    },
  );
  if (res.status >= 400) {
    logger.error("OpenAPI key exchange HTTP error", { status: res.status, data: res.data });
    throw new Error(`OpenAPI key exchange failed: HTTP ${res.status}`);
  }
  const body = res.data as Record<string, unknown>;
  const code = Number(body.code ?? -1);
  if (code !== 0) {
    logger.error("OpenAPI key exchange business error", { code, msg: body.msg, data: body.data });
    throw new Error(`OpenAPI key exchange failed: code ${code} ${body.msg ?? ""}`);
  }
  const keyIdent = pickHeader(res, ["x-key-ident", "X-Key-Ident"]);
  const dataField = body.data;
  if (typeof dataField !== "string" || !dataField) {
    throw new Error("OpenAPI response missing encrypted data field");
  }
  const decrypted = decryptOpenApiDataB64(dataField, ccHex);
  let serverPublicKeyHex = decrypted.trim();
  if (serverPublicKeyHex.startsWith("{")) {
    const j = JSON.parse(serverPublicKeyHex) as Record<string, string>;
    serverPublicKeyHex = j.server_public_key ?? j.serverPublicKey ?? j.public_key ?? serverPublicKeyHex;
  }
  if (!/^[0-9a-fA-F]+$/.test(serverPublicKeyHex) || serverPublicKeyHex.length < 64) {
    logger.warn("Unexpected server public key shape; check SOUNDCORE_CC_HEX / AES derivation", {
      sample: serverPublicKeyHex.slice(0, 80),
    });
  }
  return { keyIdent, serverPublicKeyHex, raw: body };
}

export async function ecdhPostPlain(
  baseUrl: string,
  path: string,
  innerPayload: Record<string, unknown>,
  material: Pick<EcdhSessionMaterial, "shareKeyHex32" | "aesKey" | "keyIdent" | "openudid"> &
    Partial<Pick<EcdhSessionMaterial, "authToken" | "userId">>,
  language: string,
): Promise<unknown> {
  const ts = Date.now();
  const once = `${ts}-${Math.random().toString(36).slice(2, 14)}`;
  const innerJson = JSON.stringify(innerPayload);
  const bodyB64 = wrapPlaintextToBodyB64(innerJson, material.aesKey);
  const sig = wrappedApiHmac(material.shareKeyHex32, String(ts), once, bodyB64);

  const gToken = material.userId ? md5Hex(material.userId) : "";

  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
    "X-Signature": sig,
    "X-Request-Ts": String(ts),
    "X-Request-Once": once,
    "X-Key-Ident": material.keyIdent,
    "App-Name": "soundcore_app",
    "App-name": "soundcore_app",
    "X-Encryption-Info": "algo_ecdh",
    "X-Aiot-Auth": "soundcore",
    "Model-Type": "WEB",
    "Model-type": "WEB",
    Language: language,
    Openudid: material.openudid,
    Origin: "https://ai.soundcore.com",
    Referer: "https://ai.soundcore.com/",
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (material.authToken) {
    headers["X-Auth-Token"] = material.authToken;
    headers.Token = material.authToken;
  }
  if (gToken) {
    headers.GToken = gToken;
    headers.gtoken = gToken;
    headers["Anker-X-User-Id"] = gToken;
    headers.Uid = gToken;
  }

  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await axios.post(url, bodyB64, { headers, validateStatus: () => true });
  if (res.status >= 400) {
    logger.error("Soundcore ECDH POST HTTP error", { path, status: res.status, data: res.data });
    throw new Error(`Soundcore POST ${path} failed: HTTP ${res.status}`);
  }
  const env = res.data as SoundcoreApiEnvelope;
  if (typeof env !== "object" || env === null) {
    throw new Error(`Soundcore POST ${path}: invalid response`);
  }
  if (Number(env.code) !== 0) {
    logger.warn("Soundcore API non-zero code", { path, code: env.code, msg: env.msg });
    throw new Error(`Soundcore POST ${path}: code ${env.code} ${env.msg ?? ""}`);
  }
  if (typeof env.data !== "string" || !env.data) {
    return {};
  }
  const plain = unwrapBodyB64ToPlain(env.data, material.aesKey);
  try {
    return JSON.parse(plain) as unknown;
  } catch {
    return plain;
  }
}

export async function passportLogin(
  email: string,
  passwordEnc: string,
  clientPubHex: string,
  material: Pick<EcdhSessionMaterial, "shareKeyHex32" | "aesKey" | "keyIdent" | "openudid">,
  language: string,
): Promise<{ authToken: string; userId: string }> {
  const inner = {
    email,
    password: passwordEnc,
    client_secret_info: { public_key: clientPubHex },
  };
  const parsed = (await ecdhPostPlain(
    SOUNDCORE_PASSPORT_BASE,
    "/passport/login",
    inner,
    material,
    language,
  )) as Record<string, unknown>;
  const authToken = String(parsed.auth_token ?? parsed.token ?? parsed.access_token ?? "");
  const userId = String(parsed.user_id ?? parsed.userid ?? parsed.uid ?? "");
  if (!authToken || !userId) {
    logger.error("Passport login: missing token or user id", { keys: Object.keys(parsed) });
    throw new Error("Passport login failed: auth_token / user_id not found in decrypted response");
  }
  return { authToken, userId };
}

export async function appAudioPost(
  path: string,
  innerPayload: Record<string, unknown>,
  session: EcdhSessionMaterial,
  language: string,
): Promise<unknown> {
  return ecdhPostPlain(SOUNDCORE_APP_BASE, path, innerPayload, session, language);
}
