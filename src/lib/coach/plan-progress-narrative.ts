import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { coachNarrative } from "@/db/schema";
import type { PlanRollup } from "@/lib/analytics/plan-rollup";

const MODEL = "gemini-2.5-flash";
const PROMPT_VERSION = "plan-v1";

let cachedClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export const PlanProgressSchema = z.object({
  headline: z.string(),
  trajectory: z.string(),
  keyWins: z.array(z.string()).max(3),
  keyConcerns: z.array(z.string()).max(3),
  focusNextWeek: z.string(),
});
export type PlanProgressNarrative = z.infer<typeof PlanProgressSchema>;

const PLAN_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One line summing up where the athlete stands in the plan (~60-90 chars).",
    },
    trajectory: {
      type: "string",
      description:
        "2-4 sentences describing overall plan-progress trajectory. Reference actual numbers from the cumulative + recent-trend data.",
    },
    keyWins: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "1-3 concrete wins from the plan so far.",
    },
    keyConcerns: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description:
        "0-3 concrete concerns, grounded in flags or metrics. Empty if none.",
    },
    focusNextWeek: {
      type: "string",
      description:
        "One clear sentence on what to focus on next week to keep the trajectory positive.",
    },
  },
  required: ["headline", "trajectory", "keyWins", "keyConcerns", "focusNextWeek"],
};

const SAFETY_PREAMBLE = `You are the Basecamp coach. Review the athlete's
plan-wide progress and give an honest, forward-looking take.

Hard rules:
- Never invent numbers not in the rollup below.
- Never diagnose medical conditions or recommend drugs.
- Distinguish wearable/estimated signals from clinical measurements.
- If the plan is very early (weeksElapsed < 2), acknowledge that and
  focus on establishing consistency; avoid over-interpreting thin data.
- If flags indicate recovery stress or declining compliance, recommend
  easing off rather than pushing through.
- Coach tone: concise, direct, forward-looking. Not retrospective.
  This is 'how am I doing overall + what's next' — not 'grade this
  week'.`;

function buildPrompt(rollup: PlanRollup): string {
  return `${SAFETY_PREAMBLE}

PLAN-WIDE ROLLUP:
${JSON.stringify(rollup, null, 2)}

Write the plan-progress narrative:
- headline: one line summing up trajectory + phase context.
- trajectory: 2-4 sentences on overall progress with actual numbers.
- keyWins: 1-3 concrete wins from the plan so far.
- keyConcerns: 0-3 concrete concerns grounded in flags/metrics.
- focusNextWeek: one clear sentence on next-week focus.`;
}

function inputHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input) + "|" + PROMPT_VERSION + "|" + MODEL)
    .digest("hex");
}

async function callGemini(prompt: string): Promise<unknown> {
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: PLAN_JSON_SCHEMA,
      temperature: 0.4,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

export async function generatePlanProgress(
  userId: number,
  rollup: PlanRollup,
): Promise<PlanProgressNarrative | null> {
  const hash = inputHash(rollup);
  const cached = await db
    .select()
    .from(coachNarrative)
    .where(eq(coachNarrative.inputHash, hash))
    .limit(1);
  if (cached[0]) {
    try {
      return PlanProgressSchema.parse(JSON.parse(cached[0].contentJson));
    } catch {
      // stale — regenerate
    }
  }

  try {
    const raw = await callGemini(buildPrompt(rollup));
    const parsed = PlanProgressSchema.parse(raw);
    await db
      .insert(coachNarrative)
      .values({
        userId,
        kind: "plan",
        inputHash: hash,
        promptVersion: PROMPT_VERSION,
        model: MODEL,
        contentJson: JSON.stringify(parsed),
      })
      .onConflictDoNothing({ target: coachNarrative.inputHash });
    return parsed;
  } catch (e) {
    console.error("generatePlanProgress failed:", e);
    return null;
  }
}
