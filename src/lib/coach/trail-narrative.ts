import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { coachNarrative, type Trail } from "@/db/schema";
import type { TrailAssessment } from "@/lib/basecamp/trail-assessment";
import type { PrepPlan } from "@/lib/basecamp/trail-prep-plan";

const MODEL = "gemini-2.5-flash";
const PROMPT_VERSION = "trail-v1";

let cachedClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export const TrailNarrativeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  keyMoves: z.array(z.string()).max(5),
  onDay: z.array(z.string()).max(5),
  cutOffs: z.array(z.string()).max(3),
  planNarrative: z.string(),
});
export type TrailNarrative = z.infer<typeof TrailNarrativeSchema>;

const TRAIL_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One line summing up the verdict + any tension (~60-90 chars).",
    },
    summary: {
      type: "string",
      description:
        "2-4 sentences: what makes this trail hard or easy for THIS athlete, given the dimension breakdowns.",
    },
    keyMoves: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description:
        "1-5 concrete pre-trip prep tips grounded in the dimension gaps.",
    },
    onDay: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
      description:
        "1-5 tactics for the trail day itself (pacing, fueling, weather windows, gear).",
    },
    cutOffs: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description:
        "0-3 clear bail conditions ('turn around if…'). Empty if not needed.",
    },
    planNarrative: {
      type: "string",
      description:
        "2-4 sentences explaining the deterministic prep plan (if any) OR why no prep plan applies (comfortable / do-not-attempt / too-late).",
    },
  },
  required: [
    "headline",
    "summary",
    "keyMoves",
    "onDay",
    "cutOffs",
    "planNarrative",
  ],
};

const SAFETY_PREAMBLE = `You are the Basecamp trail coach. Advise a returning
endurance/mountaineering athlete on a specific trail objective given their
current (recent-window) fitness snapshot.

Hard rules:
- Never invent numbers or facts not in the assessment/plan below.
- Never diagnose medical conditions or recommend supplements/drugs.
- Distinguish wearable/estimated signals from clinical measurements.
- If altitude ≥12,000 ft AND the athlete has no recent altitude exposure,
  flag acclimatization risk explicitly.
- If recovery flags are present (RHR/HRV/sleep), advise more rest before
  the trail; do not push through concerning symptoms.
- If verdict is "do_not_attempt", explain WHY in the summary and use
  planNarrative for realistic alternatives — do not just say "you can't
  do this."
- Coach tone: concise, direct, respectful of the athlete's experience.`;

function buildPrompt(
  trail: Trail,
  assessment: TrailAssessment,
  plan: PrepPlan,
): string {
  return `${SAFETY_PREAMBLE}

TRAIL:
${JSON.stringify(
  {
    name: trail.name,
    distanceKm: trail.distanceKm,
    elevationGainFt: trail.elevationGainFt,
    maxAltitudeFt: trail.maxAltitudeFt,
    typicalHours: trail.typicalHours,
    packWeightLb: trail.packWeightLb,
    terrainGrade: trail.terrainGrade,
    targetDate: trail.targetDate,
    notes: trail.notes,
  },
  null,
  2,
)}

ASSESSMENT (deterministic):
${JSON.stringify(assessment, null, 2)}

PREP PLAN (deterministic):
${JSON.stringify(plan, null, 2)}

Write the narrative:
- headline: verdict + tension in one line.
- summary: 2-4 sentences on what this athlete faces on THIS trail.
- keyMoves: 1-5 pre-trip prep tips grounded in the dimension gaps.
- onDay: 1-5 day-of tactics.
- cutOffs: 0-3 bail conditions.
- planNarrative: 2-4 sentences on the prep plan (or why there isn't one).`;
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
      responseJsonSchema: TRAIL_JSON_SCHEMA,
      temperature: 0.4,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

export async function generateTrailNarrative(
  userId: number,
  trail: Trail,
  assessment: TrailAssessment,
  plan: PrepPlan,
): Promise<TrailNarrative | null> {
  const hash = inputHash({ trail, assessment, plan });

  const cached = await db
    .select()
    .from(coachNarrative)
    .where(eq(coachNarrative.inputHash, hash))
    .limit(1);
  if (cached[0]) {
    try {
      return TrailNarrativeSchema.parse(JSON.parse(cached[0].contentJson));
    } catch {
      // stale/malformed cache — regenerate
    }
  }

  try {
    const raw = await callGemini(buildPrompt(trail, assessment, plan));
    const parsed = TrailNarrativeSchema.parse(raw);
    await db
      .insert(coachNarrative)
      .values({
        userId,
        kind: "trail",
        inputHash: hash,
        promptVersion: PROMPT_VERSION,
        model: MODEL,
        contentJson: JSON.stringify(parsed),
      })
      .onConflictDoNothing({ target: coachNarrative.inputHash });
    return parsed;
  } catch (e) {
    console.error("generateTrailNarrative failed:", e);
    return null;
  }
}
