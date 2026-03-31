import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import {
  buildClientPublicKeyB64,
  computeShareKeyHex32,
  createPrime256v1Ecdh,
  encryptPasswordToLoginField,
} from "./crypto.js";
import { postOpenApiKeyExchange, passportLogin, type EcdhSessionMaterial } from "./client.js";

let session: EcdhSessionMaterial | null = null;

export function setSession(s: EcdhSessionMaterial | null): void {
  session = s;
}

export function getSession(): EcdhSessionMaterial | null {
  return session;
}

export function getSessionOrThrow(): EcdhSessionMaterial {
  if (!session) throw new Error("Soundcore session not established");
  return session;
}

export async function establishSession(cfg: AppConfig): Promise<EcdhSessionMaterial> {
  setSession(null);
  const openudid = randomUUID();

  if (cfg.SOUNDCORE_SKIP_LOGIN === "1") {
    const shareKeyHex32 = cfg.SOUNDCORE_SHARE_KEY_HEX!.slice(0, 32);
    const aesKey = Buffer.from(shareKeyHex32, "hex");
    if (aesKey.length !== 16) {
      throw new Error("SOUNDCORE_SHARE_KEY_HEX must yield 16 bytes (32 hex chars)");
    }
    const s: EcdhSessionMaterial = {
      shareKeyHex32,
      aesKey,
      keyIdent: cfg.SOUNDCORE_KEY_IDENT!,
      clientPubHex: "",
      openudid,
      authToken: cfg.SOUNDCORE_AUTH_TOKEN!,
      userId: cfg.SOUNDCORE_USER_ID!,
    };
    setSession(s);
    logger.info("Soundcore session loaded from env (SOUNDCORE_SKIP_LOGIN=1)");
    return s;
  }

  const ccHex = cfg.SOUNDCORE_CC_HEX!;
  const clientEcdh = createPrime256v1Ecdh();
  const clientPubHex = clientEcdh.getPublicKey("hex");
  const clientPublicKeyB64 = buildClientPublicKeyB64(clientPubHex, ccHex);

  const { keyIdent, serverPublicKeyHex } = await postOpenApiKeyExchange(ccHex, clientPublicKeyB64);
  if (!keyIdent) {
    logger.warn("Key exchange returned empty X-Key-Ident; subsequent calls may fail");
  }

  const shareKeyHex32 = computeShareKeyHex32(clientEcdh, serverPublicKeyHex);
  const aesKey = Buffer.from(shareKeyHex32, "hex");

  const baseMaterial: Pick<EcdhSessionMaterial, "shareKeyHex32" | "aesKey" | "keyIdent" | "clientPubHex" | "openudid"> = {
    shareKeyHex32,
    aesKey,
    keyIdent,
    clientPubHex,
    openudid,
  };

  const passwordEnc = encryptPasswordToLoginField(cfg.SOUNDCORE_PASSWORD!, cfg.SOUNDCORE_LOGIN_SERVER_PUB_HEX!);
  const { authToken, userId } = await passportLogin(
    cfg.SOUNDCORE_EMAIL!,
    passwordEnc,
    clientPubHex,
    baseMaterial,
    cfg.SOUNDCORE_LANGUAGE,
  );

  const full: EcdhSessionMaterial = {
    ...baseMaterial,
    authToken,
    userId,
  };
  setSession(full);
  logger.info("Soundcore session established (login ok)", { userId: userId.slice(0, 4) + "…" });
  return full;
}
