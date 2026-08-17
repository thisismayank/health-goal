/**
 * LLM narrative for the weekly Featured Trail. Two short strings:
 *   hook — one strong sentence ('Why this pick right now')
 *   why  — 2-3 sentences of context that make the pick feel intentional
 *
 * Cached in coach_narrative keyed by (hikerClass + preset.slug + weekTag).
 * All users at the same class in the same week share the narrative —
 * O(classes × weeks) Gemini calls, not O(users).
 */

import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { coachNarrative } from "@/db/schema";
import type { TrailPreset } from "@/lib/basecamp/trail-library";
import type { Rank } from "@/lib/basecamp/rank";

const MODEL = "gemini-2.5-flash";
const PROMPT_VERSION = "featured-v1";

let cachedClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export const FeaturedNarrativeSchema = z.object({
  hook: z.string(),
  why: z.string(),
});
export type FeaturedNarrative = z.infer<typeof FeaturedNarrativeSchema>;

const FEATURED_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    hook: {
      type: "string",
      description:
        "One sentence (~50-90 chars) that captures why THIS trail this week for a Hiker Class {N}. Not generic — reference something concrete about the trail.",
    },
    why: {
      type: "string",
      description:
        "2-3 sentences of context. Talk about what makes this trail interesting for this class of hiker, what conditions make this week timely (season, typical weather), or what's unique to prepare for.",
    },
  },
  required: ["hook", "why"],
};

const SAFETY_PREAMBLE = `You are the Basecamp trail curator. You've picked
this week's Featured Trail for hikers at a specific class. Your job: give
them a compelling one-line hook + short 'why this trail' context.

Hard rules:
- Never invent numbers or facts not in the trail info below.
- Never recommend doing this trail — that's for the readiness engine.
- Don't be generic ('this beautiful trail offers...'). Be specific.
- Tone: knowledgeable friend, not marketing copy.
- 'why' can reference season/timing where relevant (e.g. 'shoulder season
  makes exposed ridges more comfortable', 'late spring peak snowmelt
  affects river crossings'). Only invoke seasonality if it clearly
  matters — otherwise skip it.
- Keep it tight. Total output under 100 words.`;

function buildPrompt({
  preset,
  hikerClass,
  weekTag,
}: {
  preset: TrailPreset;
  hikerClass: Rank;
  weekTag: string;
}): string {
  return `${SAFETY_PREAMBLE}

Featured Trail context:
${JSON.stringify(
  {
    hikerClass,
    weekTag,
    trail: {
      name: preset.name,
      region: preset.region,
      country: preset.country,
      distanceKm: preset.distanceKm,
      elevationGainFt: preset.elevationGainFt,
      maxAltitudeFt: preset.maxAltitudeFt,
      typicalHours: preset.typicalHours,
      packWeightLb: preset.packWeightLb,
      terrainGrade: preset.terrainGrade,
      notes: preset.notes,
    },
  },
  null,
  2,
)}

Write:
- hook: one line, ~50-90 chars.
- why: 2-3 sentences on why this trail is worth this Class ${hikerClass} hiker's attention this week.`;
}

function inputHash(
  hikerClass: Rank,
  preset: TrailPreset,
  weekTag: string,
): string {
  return createHash("sha256")
    .update(
      `${hikerClass}|${preset.slug}|${weekTag}|${PROMPT_VERSION}|${MODEL}`,
    )
    .digest("hex");
}

async function callGemini(prompt: string): Promise<unknown> {
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: FEATURED_JSON_SCHEMA,
      temperature: 0.55,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

/**
 * Cached generation. userId is passed in so we can attribute the row (for
 * later cleanup), but the CACHE KEY is class + preset + week — so the
 * first user in a class within a week pays the Gemini cost and every
 * subsequent user (in the email cron or on home) gets the cached copy.
 */
export async function generateFeaturedNarrative({
  userId,
  hikerClass,
  preset,
  weekTag,
}: {
  userId: number;
  hikerClass: Rank;
  preset: TrailPreset;
  weekTag: string;
}): Promise<FeaturedNarrative | null> {
  const hash = inputHash(hikerClass, preset, weekTag);
  const cached = await db
    .select()
    .from(coachNarrative)
    .where(eq(coachNarrative.inputHash, hash))
    .limit(1);
  if (cached[0]) {
    try {
      return FeaturedNarrativeSchema.parse(JSON.parse(cached[0].contentJson));
    } catch {
      // stale/malformed → regenerate
    }
  }
  try {
    const raw = await callGemini(buildPrompt({ preset, hikerClass, weekTag }));
    const parsed = FeaturedNarrativeSchema.parse(raw);
    await db
      .insert(coachNarrative)
      .values({
        userId,
        kind: "featured",
        inputHash: hash,
        promptVersion: PROMPT_VERSION,
        model: MODEL,
        contentJson: JSON.stringify(parsed),
      })
      .onConflictDoNothing({ target: coachNarrative.inputHash });
    return parsed;
  } catch (e) {
    console.error("generateFeaturedNarrative failed:", e);
    return null;
  }
}
