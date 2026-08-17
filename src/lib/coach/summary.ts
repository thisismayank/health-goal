/**
 * Rolling summary of coach-chat history beyond the recent window.
 *
 * Motivation: we ship the last ~40 turns to the model on every send
 * (see /api/coach/message). Anything older gets forgotten — a real
 * problem when the user has told the coach they're rebuilding from a
 * knee injury or that they're training a friend's daughter for a
 * Kili trek, and then two weeks later the coach has no idea.
 *
 * This module maintains a single rolling text digest per user. On the
 * send path we call maybeRegenerate() which is cheap when there's
 * nothing to fold in, and does one small LLM call when the
 * unsummarized turn count crosses SUMMARIZE_EVERY_N. The digest is
 * fed into the coach system prompt as a --- PRIOR CONVERSATION
 * SUMMARY --- block.
 *
 * Design tradeoffs:
 *   - We use the same provider + creds the user connected for chat.
 *     No shared summarizer key, no billing hoops.
 *   - Regen is best-effort: if the LLM call errors, we log and move
 *     on. The user's chat continues with the stale summary + recent
 *     turns; no reason to block a message on a housekeeping op.
 *   - The digest is a single paragraph (150-250 words). Not a
 *     structured JSON of "goals / injuries / preferences" — the
 *     model handles that shape better than us prescribing it.
 */

import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage, coachSummary } from "@/db/schema";
import { getAdapter } from "@/lib/llm/providers";
import { getCredsForRequest } from "@/lib/llm/credentials";

const SUMMARIZE_EVERY_N = 20; // regen after this many new turns
const RECENT_WINDOW = 20; // keep this many recent turns as-is (roughly half of chat window)

const SUMMARIZER_SYSTEM = `You are a chat summarizer. Produce a compact 150-250 word digest of a hiking coach's prior conversation with a user. Preserve durable facts: named injuries, gear preferences, mentioned trips (with dates if given), stated goals, and any explicit preferences the coach should remember ("I hate stairmaster", "I train Tuesdays and Thursdays"). Skip pleasantries, discarded plans, one-off questions the coach already answered.

Write one paragraph in the third person ("The user is...", "They mentioned..."). No headings, no bullets. Be terse and load-bearing — every sentence should earn its place. If the prior summary already captured something, keep it and layer the new turns on top rather than restating.`;

export async function getCoachSummary(userId: number): Promise<{
  content: string;
  updatedAt: Date;
} | null> {
  const [row] = await db
    .select({
      content: coachSummary.content,
      updatedAt: coachSummary.updatedAt,
    })
    .from(coachSummary)
    .where(eq(coachSummary.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Fold any messages newer than the last summary into a fresh digest,
 * but only when the unsummarized count is large enough to be worth
 * the LLM call. Safe to call on every message — cheap in the common
 * case (fewer than SUMMARIZE_EVERY_N new turns → no-op).
 *
 * Returns true when a regen ran (for logging / tests). Never throws.
 */
export async function maybeRegenerate(userId: number): Promise<boolean> {
  try {
    const [prior] = await db
      .select({
        id: coachSummary.id,
        content: coachSummary.content,
        throughMessageId: coachSummary.throughMessageId,
      })
      .from(coachSummary)
      .where(eq(coachSummary.userId, userId))
      .limit(1);

    // Unsummarized turns: everything with id > prior.throughMessageId,
    // MINUS the recent window we keep verbatim.
    const cutoff = prior?.throughMessageId ?? 0;
    const unsummarized = await db
      .select({
        id: coachMessage.id,
        role: coachMessage.role,
        content: coachMessage.content,
      })
      .from(coachMessage)
      .where(
        and(eq(coachMessage.userId, userId), gt(coachMessage.id, cutoff)),
      )
      .orderBy(asc(coachMessage.id));

    // We only want to summarize the OLDER portion of unsummarized
    // turns. The most recent RECENT_WINDOW turns keep their raw
    // representation in the chat context.
    const toFold = unsummarized.slice(0, -RECENT_WINDOW);
    if (toFold.length < SUMMARIZE_EVERY_N) return false;

    const creds = await getCredsForRequest(userId);
    if (!creds) return false; // no provider; can't summarize

    const adapter = getAdapter(creds.provider);

    const transcript = toFold
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const priorBlock = prior?.content
      ? `--- PRIOR SUMMARY (fold new turns into this, do not restate) ---\n${prior.content}\n\n`
      : "";
    const userPrompt = `${priorBlock}--- NEW TURNS TO INCORPORATE ---\n${transcript}`;

    let text = "";
    for await (const chunk of adapter.streamChat({
      apiKey: creds.apiKey,
      modelId: creds.modelId ?? undefined,
      system: SUMMARIZER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 512,
    })) {
      if (chunk.kind === "delta") text += chunk.text;
    }
    text = text.trim();
    if (!text) return false;

    const newThrough = toFold[toFold.length - 1].id;

    if (prior) {
      await db
        .update(coachSummary)
        .set({ content: text, throughMessageId: newThrough, updatedAt: new Date() })
        .where(eq(coachSummary.id, prior.id));
    } else {
      await db
        .insert(coachSummary)
        .values({ userId, content: text, throughMessageId: newThrough });
    }
    return true;
  } catch (e) {
    console.warn("[coach/summary] regen failed:", e);
    return false;
  }
}

/**
 * Latest raw assistant message we've stored, so tee-up logic can
 * decide "how long since the coach last spoke to me." Includes both
 * organic and tee_up-origin messages.
 */
export async function lastAssistantAt(userId: number): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: coachMessage.createdAt })
    .from(coachMessage)
    .where(
      and(
        eq(coachMessage.userId, userId),
        eq(coachMessage.role, "assistant"),
      ),
    )
    .orderBy(desc(coachMessage.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}
