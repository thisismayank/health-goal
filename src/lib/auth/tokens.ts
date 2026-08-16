import { randomBytes } from "node:crypto";

/**
 * Generate a URL-safe random token. 32 bytes = 256 bits of entropy, base64url
 * encoded (no padding, no + or /). Used for both magic-link tokens and
 * session tokens.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  // Pragmatic check — full RFC 5322 is not worth it. Reject obvious garbage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
