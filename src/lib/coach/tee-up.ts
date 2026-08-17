/**
 * Coach tee-up: an auto-generated opening line the coach "sends" when
 * the user opens /coach after a gap (or for the first time). This is
 * the difference between a chatbot ("hi, how can I help") and a
 * coach ("you skipped the long session on Sunday — bad weather or
 * how are the legs?").
 *
 * The tee-up is stored as a regular coach_message row with
 * origin='tee_up' so it appears in the history like any other
 * assistant turn (persistent, resumable, replaceable by the user
 * clicking Clear).
 *
 * We only tee up when:
 *   1. The chat is empty (first ever visit), OR
 *   2. The last assistant message is older than TEE_UP_GAP_MS.
 *
 * If the tee-up LLM call fails, we return null and the client
 * renders the existing empty state / just picks up wherever it was.
 */

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage, type UserProfile } from "@/db/schema";
import { getAdapter } from "@/lib/llm/providers";
import { getCredsForRequest, markUsed } from "@/lib/llm/credentials";
import { buildCoachSystem } from "@/lib/llm/coach-context";

const TEE_UP_GAP_MS = 24 * 60 * 60 * 1000;

const TEE_UP_PROMPT = `You are opening the conversation for a returning user. Look at the context above (this week's sessions, recent workouts, recovery signal, any prior conversation summary). Write ONE proactive opener — 1 to 2 short sentences, max 40 words.

Rules for a good opener:
- Reference something specific and current: a missed session, an upcoming session, a completed workout, a recovery flag, or something the user mentioned in the prior summary (e.g. an injury they were dealing with, a trip they were prepping for).
- End with a question that invites a reply, but only if it's a real question. "How's the knee?" beats "How's everything going?"
- If literally nothing is happening (new user, no plan, no workouts), say hi and ask what the user's after.

Do NOT:
- Restate a full status report (they can see the app).
- Use emojis, exclamation points, or "hey champ!" energy.
- Ask more than one question.
- Recommend anything specific until you know more.

Output only the opener text, no preface, no quotes.`;

/**
 * Returns the persisted opener message when we produced one on this
 * call. Returns null when we didn't need to tee up (recent chat) or
 * couldn't (no creds, LLM error).
 */
export async function maybeGenerateTeeUp(user: UserProfile): Promise<{
  id: number;
  content: string;
  createdAt: Date;
} | null> {
  const [last] = await db
    .select({ role: coachMessage.role, createdAt: coachMessage.createdAt })
    .from(coachMessage)
    .where(eq(coachMessage.userId, user.id))
    .orderBy(desc(coachMessage.createdAt))
    .limit(1);

  // Skip if the last turn is fresh — user is mid-conversation and
  // an opener would be jarring.
  if (last && Date.now() - last.createdAt.getTime() < TEE_UP_GAP_MS) {
    return null;
  }
  // Also skip if the LAST message was a tee_up we already generated
  // (checked via createdAt gap above already, but belt-and-braces:
  // never produce two tee-ups back-to-back without an intervening
  // user turn).
  if (last?.role === "assistant") {
    const [priorUser] = await db
      .select({ id: coachMessage.id })
      .from(coachMessage)
      .where(eq(coachMessage.userId, user.id))
      .orderBy(desc(coachMessage.id))
      .limit(1);
    // If the last row is assistant and its timestamp is stale, that
    // means the user hasn't replied since — no point regenerating.
    // The stored tee-up is still there for them to react to.
    if (priorUser?.id) return null;
  }

  const creds = await getCredsForRequest(user.id);
  if (!creds) return null;

  const adapter = getAdapter(creds.provider);
  const system = await buildCoachSystem(user);

  try {
    let text = "";
    for await (const chunk of adapter.streamChat({
      apiKey: creds.apiKey,
      modelId: creds.modelId ?? undefined,
      system,
      messages: [{ role: "user", content: TEE_UP_PROMPT }],
      maxTokens: 128,
    })) {
      if (chunk.kind === "delta") text += chunk.text;
    }
    text = text.trim();
    if (!text) return null;

    const [row] = await db
      .insert(coachMessage)
      .values({
        userId: user.id,
        role: "assistant",
        content: text,
        provider: creds.provider,
        modelId: creds.modelId ?? adapter.defaultModel,
        origin: "tee_up",
      })
      .returning({
        id: coachMessage.id,
        content: coachMessage.content,
        createdAt: coachMessage.createdAt,
      });
    await markUsed(user.id);
    return row;
  } catch (e) {
    console.warn("[coach/tee-up] failed:", e);
    return null;
  }
}
