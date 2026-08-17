/**
 * Per-user LLM credential store. Plaintext handling is confined to
 * this module — the rest of the app only ever sees a decrypted
 * ChatCreds for the duration of one request, never the ciphertext.
 *
 * Invariants:
 *   - Key is AES-256-GCM encrypted at rest via APP_ENCRYPTION_KEY
 *   - Only last 4 chars are stored in plaintext (for UI display)
 *   - Full plaintext is never returned by any exported 'view' function
 *     other than getCredsForRequest, which is server-only and must
 *     never be serialized to a client
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { llmCredentials, type LlmProvider } from "@/db/schema";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";

export type LlmAccountView = {
  provider: LlmProvider;
  apiKeyLast4: string;
  modelId: string | null;
  lastUsedAt: Date | null;
  connectedAt: Date;
};

export type ChatCreds = {
  provider: LlmProvider;
  apiKey: string;
  modelId: string | null;
};

/**
 * Safe view for rendering in settings. Never includes the decrypted
 * API key — only the last-4.
 */
export async function getAccountView(
  userId: number,
): Promise<LlmAccountView | null> {
  const [row] = await db
    .select()
    .from(llmCredentials)
    .where(eq(llmCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider,
    apiKeyLast4: row.apiKeyLast4,
    modelId: row.modelId,
    lastUsedAt: row.lastUsedAt,
    connectedAt: row.createdAt,
  };
}

/**
 * Server-only: decrypt the user's key for a single request. Discard
 * after use; never serialize to a client component.
 */
export async function getCredsForRequest(
  userId: number,
): Promise<ChatCreds | null> {
  const [row] = await db
    .select()
    .from(llmCredentials)
    .where(eq(llmCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider,
    apiKey: decryptSecret(row.apiKeyEncrypted),
    modelId: row.modelId,
  };
}

export async function saveCredentials(
  userId: number,
  provider: LlmProvider,
  apiKey: string,
  modelId: string | null,
): Promise<void> {
  const values = {
    userId,
    provider,
    apiKeyEncrypted: encryptSecret(apiKey),
    apiKeyLast4: last4(apiKey),
    modelId,
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select({ id: llmCredentials.id })
    .from(llmCredentials)
    .where(eq(llmCredentials.userId, userId))
    .limit(1);
  if (existing) {
    await db
      .update(llmCredentials)
      .set(values)
      .where(eq(llmCredentials.id, existing.id));
  } else {
    await db.insert(llmCredentials).values(values);
  }
}

export async function deleteCredentials(userId: number): Promise<void> {
  await db.delete(llmCredentials).where(eq(llmCredentials.userId, userId));
}

export async function markUsed(userId: number): Promise<void> {
  await db
    .update(llmCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(llmCredentials.userId, userId));
}
