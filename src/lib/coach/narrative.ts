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
const DAILY_PROMPT_VERSION = "daily-v1";
const WEEKLY_PROMPT_VERSION = "weekly-v1";

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
- If recovery signals are poor (high fatigue, high RPE on easy work),
  recommend an easy day and modest adjustments — never push through
  concerning symptoms.
- Coach tone: concise, direct, respectful of the athlete's experience.
- Prefer concrete observations ("the 25-min walk didn't hit the 60-min
  target") over vague encouragement.`;

function buildDailyPrompt(rollup: DailyRollup): string {
  return `${SAFETY_PREAMBLE}

TODAY'S ROLLUP (JSON):
${JSON.stringify(rollup, null, 2)}

Write a punchy card:
- summary: 1–3 sentences on how the day went vs plan.
- wins: 0–3 short concrete positives.
- concerns: 0–3 short concerns. Empty if none.
- next_hint: one sentence for tomorrow.`;
}

function buildWeeklyPrompt(
  rollup: WeeklyRollup,
  decision: ProgressionResult,
): string {
  return `${SAFETY_PREAMBLE}

WEEKLY ROLLUP (JSON):
${JSON.stringify(rollup, null, 2)}

DETERMINISTIC PROGRESSION DECISION (do not override; explain):
${JSON.stringify(decision, null, 2)}

Write the week review:
- headline: one line.
- summary: 2–4 sentences on the week vs the plan.
- wins / concerns: short, concrete lists.
- decision_explanation: 2–3 sentences on why the decision was reached.
- proposed_changes: turn the decision's 'hints.change' slugs into
  human-readable {variable, from, to, reason} tuples. If a hint has no
  numeric change (e.g. "hold_pack_weight"), express as from/to that
  makes the intent clear (e.g. from "10 lb" to "10 lb").
- unchanged: turn 'hints.unchanged' slugs into short phrases.`;
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
  decision: ProgressionResult,
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
