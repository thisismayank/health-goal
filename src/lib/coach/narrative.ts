import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db/client";
import { coachNarrative } from "@/db/schema";
import type { ProgressionResult } from "@/lib/analytics/progression";
import type { DailyRollup, WeeklyRollup } from "@/lib/analytics/rollups";
import {
  DAILY_JSON_SCHEMA,
  DailyNarrativeSchema,
  WEEKLY_JSON_SCHEMA,
  WeeklyReviewSchema,
  type DailyNarrative,
  type WeeklyReview,
} from "./schemas";

const MODEL = "gemini-2.5-flash";
// v3 adds recovery-signals awareness (sleep/HRV/RHR baselines).
const DAILY_PROMPT_VERSION = "daily-v3";
const WEEKLY_PROMPT_VERSION = "weekly-v3";

let cachedClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function inputHash(input: unknown, promptVersion: string): string {
  return createHash("sha256")
    .update(JSON.stringify(input) + "|" + promptVersion + "|" + MODEL)
    .digest("hex");
}

async function readCache<T>(
  hash: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const rows = await db
    .select()
    .from(coachNarrative)
    .where(eq(coachNarrative.inputHash, hash))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return schema.parse(JSON.parse(rows[0].contentJson));
  } catch {
    return null;
  }
}

async function saveCache(
  userId: number,
  kind: "daily" | "weekly",
  hash: string,
  promptVersion: string,
  content: unknown,
) {
  await db
    .insert(coachNarrative)
    .values({
      userId,
      kind,
      inputHash: hash,
      promptVersion,
      model: MODEL,
      contentJson: JSON.stringify(content),
    })
    .onConflictDoNothing({ target: coachNarrative.inputHash });
}

async function callGemini(
  prompt: string,
  jsonSchema: Record<string, unknown>,
): Promise<unknown> {
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: 0.4,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

const SAFETY_PREAMBLE = `You are the Rainier Companion coach. The athlete is training for a
guided Mount Rainier summit in ~10 months. They are a returning
endurance/mountaineering athlete, currently rebuilding volume — not a
beginner. Vegetarian diet, based in Manhattan.

Hard rules:
- Never invent numbers or facts not in the rollup below.
- Never diagnose medical conditions or recommend supplements/drugs.
- Distinguish wearable/estimated signals from clinical measurements.
- Coach tone: concise, direct, respectful of the athlete's experience.
- Prefer concrete observations ("the 25-min walk didn't hit the 60-min
  target") over vague encouragement.

CRITICAL — RECOVERY SIGNALS:
- Resting HR (RHR) and Heart Rate Variability (HRV) baselines are
  personal medians of the trailing 21 days — NOT population norms.
  Only interpret them as deltas from that personal baseline.
- If concernFlags contains "rhr_high" (>=8 bpm above baseline),
  "hrv_low" (>=15% below baseline), or "sleep_short" (<5.5h), the
  body is signaling stress. Recommend an easier session or a rest day,
  and modest adjustments — never advise pushing through.
- If no recovery signals are present (recovery.hasAnySignal is false),
  do NOT invent them. Just work with what's in the rollup.

CRITICAL — TEMPORAL FRAMING:
- If the rollup says the day/week is still IN PROGRESS, you are looking
  at a snapshot mid-day or mid-week. DO NOT describe planned work as
  "missed", "skipped", or "not completed". The athlete may still be
  going to do it. Frame everything as status + what's ahead.
- Only in RETROSPECTIVE mode (day/week is over) may you describe
  planned work as missed and grade the period.`;

function buildDailyPrompt(rollup: DailyRollup): string {
  const inProgress = rollup.context.isCurrentDay;

  const inProgressGuidance = `
MODE: IN PROGRESS
The current local time is ${rollup.context.localWallTime} (${rollup.context.partOfDay}).
The day is NOT over yet — the athlete may still do the planned work.

Fill the schema like this:
- summary: 1–3 sentences describing what's happened so far today and
  what's still on today's plan. Frame the planned session as "still
  ahead" or "coming up" — never "missed" while it's still ${rollup.context.partOfDay}.
- wins: 0–3 short positives from what's been done so far today.
- concerns: 0–3 concrete things to watch for the REMAINDER of today.
  Empty if none. NOT "you skipped X" — instead "X still needs to happen".
- next_hint: one sentence about what to focus on for the rest of TODAY
  (not tomorrow). Timing advice is welcome (e.g., "get out before heat").
  If nothing planned remains and the athlete is done, encourage recovery.`;

  const retrospectiveGuidance = `
MODE: RETROSPECTIVE
The day is over. Grade what actually happened.

Fill the schema like this:
- summary: 1–3 sentences on how the day went vs plan.
- wins: 0–3 short concrete positives.
- concerns: 0–3 short concerns. Empty if none.
- next_hint: one sentence for TOMORROW.`;

  return `${SAFETY_PREAMBLE}

TODAY'S ROLLUP (JSON):
${JSON.stringify(rollup, null, 2)}

${inProgress ? inProgressGuidance : retrospectiveGuidance}`;
}

function buildWeeklyPrompt(
  rollup: WeeklyRollup,
  decision: ProgressionResult | null,
): string {
  const inProgress = rollup.context.isCurrentWeek;

  const inProgressGuidance = `
MODE: IN PROGRESS
Day ${rollup.context.dayIndexInWeek} of 7 (${rollup.context.daysRemaining} day(s) remaining).
${rollup.context.plannedRemaining} planned session(s) still ahead this week.

Fill the schema like this:
- headline: one line snapshot (e.g. "Mid-week check: on pace, long
  session still ahead").
- summary: 2–4 sentences on where the week stands so far and what
  matters for the rest of it. DO NOT grade or say things were missed
  when the day for that session hasn't happened yet.
- wins: 0–3 positives from what's been completed so far.
- concerns: 0–3 things to watch for the REMAINDER of the week.
- decision_explanation: exactly "Decision deferred until the week is
  complete. Current pace: <one clause on trajectory>."
- proposed_changes: return an EMPTY array [].
- unchanged: return an empty array [].`;

  const retrospectiveGuidance = `
MODE: RETROSPECTIVE
The week is complete. Apply the deterministic decision below.

DETERMINISTIC PROGRESSION DECISION (do not override; explain):
${JSON.stringify(decision, null, 2)}

Fill the schema like this:
- headline: one line.
- summary: 2–4 sentences on the week vs the plan.
- wins / concerns: short, concrete lists.
- decision_explanation: 2–3 sentences on why the decision was reached.
- proposed_changes: turn the decision's 'hints.change' slugs into
  human-readable {variable, from, to, reason} tuples. If a hint has no
  numeric change (e.g. "hold_pack_weight"), express as from/to that
  makes the intent clear (e.g. from "10 lb" to "10 lb").
- unchanged: turn 'hints.unchanged' slugs into short phrases.`;

  return `${SAFETY_PREAMBLE}

WEEKLY ROLLUP (JSON):
${JSON.stringify(rollup, null, 2)}

${inProgress ? inProgressGuidance : retrospectiveGuidance}`;
}

export async function generateDailyNarrative(
  userId: number,
  rollup: DailyRollup,
): Promise<DailyNarrative | null> {
  const hash = inputHash(rollup, DAILY_PROMPT_VERSION);
  const cached = await readCache(hash, DailyNarrativeSchema);
  if (cached) return cached;
  try {
    const raw = await callGemini(buildDailyPrompt(rollup), DAILY_JSON_SCHEMA);
    const parsed = DailyNarrativeSchema.parse(raw);
    await saveCache(userId, "daily", hash, DAILY_PROMPT_VERSION, parsed);
    return parsed;
  } catch (e) {
    console.error("generateDailyNarrative failed:", e);
    return null;
  }
}

export async function generateWeeklyReview(
  userId: number,
  rollup: WeeklyRollup,
  decision: ProgressionResult | null,
): Promise<WeeklyReview | null> {
  const hash = inputHash({ rollup, decision }, WEEKLY_PROMPT_VERSION);
  const cached = await readCache(hash, WeeklyReviewSchema);
  if (cached) return cached;
  try {
    const raw = await callGemini(
      buildWeeklyPrompt(rollup, decision),
      WEEKLY_JSON_SCHEMA,
    );
    const parsed = WeeklyReviewSchema.parse(raw);
    await saveCache(userId, "weekly", hash, WEEKLY_PROMPT_VERSION, parsed);
    return parsed;
  } catch (e) {
    console.error("generateWeeklyReview failed:", e);
    return null;
  }
}
