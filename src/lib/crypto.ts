/**
 * Symmetric secret encryption for values we store in the DB but should
 * never expose in plaintext (third-party API keys, OAuth-adjacent
 * credentials that don't have their own refresh flow).
 *
 * Uses AES-256-GCM which gives us both confidentiality and tamper
 * detection — if a stored ciphertext is modified, decrypt() throws
 * instead of silently returning garbage.
 *
 * Storage format: base64(iv[12] || authTag[16] || ciphertext)
 *
 * Key management:
 *   - Key comes from APP_ENCRYPTION_KEY env (64 hex chars = 32 bytes)
 *   - Generate one with: `openssl rand -hex 32`
 *   - Rotating this key requires re-encrypting every stored row —
 *     out of scope for MVP, budget a migration if needed later.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set (need 64 hex chars = 32 bytes)",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with `openssl rand -hex 32`.",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const key = loadKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("decryptSecret: ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString("utf8");
}

export function last4(s: string): string {
  return s.length <= 4 ? s : s.slice(-4);
}
