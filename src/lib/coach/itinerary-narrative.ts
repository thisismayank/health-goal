/**
 * LLM narrative for a generated trip itinerary. Explains WHY the
 * deterministic algorithm ordered the trip this way, in the context of
 * the athlete's current fitness.
 *
 * Cached by input hash in coach_narrative — same (destination + days +
 * picked slugs + user snapshot fingerprint) always returns the same
 * cached response until the fitness snapshot changes materially.
 */

import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { coachNarrative, type UserProfile } from "@/db/schema";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { loadFitnessSnapshot } from "@/lib/basecamp/trail-assessment";
import type { Verdict } from "@/lib/basecamp/itinerary";

const MODEL = "gemini-2.5-flash";
const PROMPT_VERSION = "itinerary-v1";

let cachedClient: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export const ItineraryNarrativeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  perDay: z.array(z.string()).max(14),
});
export type ItineraryNarrative = z.infer<typeof ItineraryNarrativeSchema>;

const ITINERARY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One line summarizing the rhythm of the trip (~50-80 chars). E.g. 'Skyline warms you up, Burroughs is the marquee, easy finish.'",
    },
    summary: {
      type: "string",
      description:
        "2-3 sentences explaining the sequence logic for THIS athlete — reference their Hiker Class, their recent training pattern, and the specific destination. Not generic advice.",
    },
    perDay: {
      type: "array",
      items: { type: "string" },
      maxItems: 14,
      description:
        "One line per DAY (including rest/unfilled days) explaining why this pick makes sense on that day. Same order as the input days. Rest days get a 1-liner too. Keep each under 100 chars.",
    },
  },
  required: ["headline", "summary", "perDay"],
};

const SAFETY_PREAMBLE = `You are the Basecamp trail coach. You've been given
an auto-generated trip itinerary for a specific athlete. Your job: explain
why this sequence makes sense for THIS athlete, at their current fitness,
at this destination.

Hard rules:
- Never invent trails, distances, or numbers not in the input.
- Never diagnose medical conditions or recommend drugs.
- Reference the athlete's Hiker Class + fitness signals concretely.
- Ground your reasoning in actual sequencing logic (arrival warmup /
  marquee middle / travel-day taper / rest between big efforts) — not
  vague affirmations.
- Coach tone: direct, tactical, warm. Not fluffy.
- Keep total output under ~200 words.
- Never mention 'the algorithm' — talk about the trip like a coach.`;

export type ItineraryDayForCoach =
  | {
      kind: "hike";
      dayIndex: number;
      dateYmd: string;
      trailName: string;
      distanceKm: number;
      elevationGainFt: number;
      typicalHours: number;
      terrainGrade: string;
      verdict: Verdict;
    }
  | { kind: "rest"; dayIndex: number; dateYmd: string; reason: string }
  | { kind: "unfilled"; dayIndex: number; dateYmd: string };

export type ItineraryContext = {
  destination: string;
  days: number;
  totals: {
    hikes: number;
    hours: number;
    verticalFt: number;
  };
  itinerary: ItineraryDayForCoach[];
  athlete: {
    name: string;
    hikerClass: string; // e.g. "D"
    classLabel: string; // e.g. "Weekend Hiker"
    endWeeklyMin: number;
    longestSessionMin: number;
    maxSingleSessionVertFt: number;
    maxPackLb: number;
  };
};

function buildPrompt(ctx: ItineraryContext): string {
  return `${SAFETY_PREAMBLE}

TRIP CONTEXT
${JSON.stringify(ctx, null, 2)}

Write the itinerary narrative:
- headline: one line summing up the shape of the trip.
- summary: 2-3 sentences on why this order works for this athlete at
  this fitness level.
- perDay: one line per day in order (matching input length), explaining
  why THIS trail (or rest, or nothing) on THIS day.`;
}

function inputHash(userId: number, ctx: ItineraryContext): string {
  // Cache key: user + full context. Any change to picks or fitness
  // signals invalidates the cache.
  return createHash("sha256")
    .update(
      String(userId) +
        "|" +
        JSON.stringify(ctx) +
        "|" +
        PROMPT_VERSION +
        "|" +
        MODEL,
    )
    .digest("hex");
}

async function callGemini(prompt: string): Promise<unknown> {
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: ITINERARY_JSON_SCHEMA,
      temperature: 0.5,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text);
}

/**
 * Build the coach's context blob and generate the narrative. Caches to
 * coach_narrative — repeated calls with the same itinerary + fitness
 * signals return instantly.
 */
export async function generateItineraryNarrative({
  user,
  destination,
  days,
  totals,
  itinerary,
}: {
  user: UserProfile;
  destination: string;
  days: number;
  totals: { hikes: number; hours: number; verticalFt: number };
  itinerary: ItineraryDayForCoach[];
}): Promise<ItineraryNarrative | null> {
  // Pull compact athlete signals for the LLM to reference.
  const [sheet, snap] = await Promise.all([
    computeCharacterSheet(user.id),
    loadFitnessSnapshot(user.id),
  ]);
  const rank = computeRank(sheet);

  const ctx: ItineraryContext = {
    destination,
    days,
    totals,
    itinerary,
    athlete: {
      name: user.name.split(" ")[0],
      hikerClass: rank.current,
      classLabel: rank.currentLabel,
      endWeeklyMin: snap.weeklyAerobicMinutes,
      longestSessionMin: snap.longestRecentSessionMin,
      maxSingleSessionVertFt: snap.maxSingleSessionVertFt,
      maxPackLb: snap.maxPackLb,
    },
  };

  const hash = inputHash(user.id, ctx);
  const cached = await db
    .select()
    .from(coachNarrative)
    .where(eq(coachNarrative.inputHash, hash))
    .limit(1);
  if (cached[0]) {
    try {
      return ItineraryNarrativeSchema.parse(JSON.parse(cached[0].contentJson));
    } catch {
      // stale — regenerate
    }
  }

  try {
    const raw = await callGemini(buildPrompt(ctx));
    const parsed = ItineraryNarrativeSchema.parse(raw);
    await db
      .insert(coachNarrative)
      .values({
        userId: user.id,
        kind: "itinerary",
        inputHash: hash,
        promptVersion: PROMPT_VERSION,
        model: MODEL,
        contentJson: JSON.stringify(parsed),
      })
      .onConflictDoNothing({ target: coachNarrative.inputHash });
    return parsed;
  } catch (e) {
    console.error("generateItineraryNarrative failed:", e);
    return null;
  }
}
