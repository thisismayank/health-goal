/**
 * Per-user intervals.icu credential store. All plaintext handling is
 * confined to this module — the rest of the codebase only ever sees
 * an already-decrypted IntervalsCreds object for the duration of one
 * request, never touches the ciphertext directly.
 *
 * Invariants:
 *   - API key is AES-256-GCM encrypted at rest via APP_ENCRYPTION_KEY
 *   - Only last 4 chars of the key are stored in plaintext (for UI)
 *   - Full plaintext is never returned by any exported "get" function
 *     other than getCredsForSync, which is server-only and never
 *     serialized to a client
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { intervalsAccount } from "@/db/schema";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import type { IntervalsCreds } from "./client";

export type IntervalsAccountView = {
  athleteId: string;
  apiKeyLast4: string;
  lastSyncAt: Date | null;
  connectedAt: Date;
};

/**
 * Safe view for rendering in the settings UI. Never includes the
 * decrypted API key — only last-4 for verification.
 */
export async function getAccountView(
  userId: number,
): Promise<IntervalsAccountView | null> {
  const [row] = await db
    .select()
    .from(intervalsAccount)
    .where(eq(intervalsAccount.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    athleteId: row.athleteId,
    apiKeyLast4: row.apiKeyLast4,
    lastSyncAt: row.lastSyncAt,
    connectedAt: row.createdAt,
  };
}

/**
 * Loads decrypted credentials for server-side sync. NEVER return the
 * result of this function to a client component. Callers should use
 * the value inline and discard.
 */
export async function getCredsForSync(
  userId: number,
): Promise<IntervalsCreds | null> {
  const [row] = await db
    .select()
    .from(intervalsAccount)
    .where(eq(intervalsAccount.userId, userId))
    .limit(1);
  if (!row) return null;
  const apiKey = decryptSecret(row.apiKeyEncrypted);
  return { athleteId: row.athleteId, apiKey };
}

export async function saveCredentials(
  userId: number,
  athleteId: string,
  apiKey: string,
): Promise<void> {
  const values = {
    userId,
    athleteId,
    apiKeyEncrypted: encryptSecret(apiKey),
    apiKeyLast4: last4(apiKey),
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select({ id: intervalsAccount.id })
    .from(intervalsAccount)
    .where(eq(intervalsAccount.userId, userId))
    .limit(1);
  if (existing) {
    await db
      .update(intervalsAccount)
      .set(values)
      .where(eq(intervalsAccount.id, existing.id));
  } else {
    await db.insert(intervalsAccount).values(values);
  }
}

export async function deleteCredentials(userId: number): Promise<void> {
  await db.delete(intervalsAccount).where(eq(intervalsAccount.userId, userId));
}

export async function markSynced(userId: number): Promise<void> {
  await db
    .update(intervalsAccount)
    .set({ lastSyncAt: new Date() })
    .where(eq(intervalsAccount.userId, userId));
}
