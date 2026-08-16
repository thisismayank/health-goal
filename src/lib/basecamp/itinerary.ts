/**
 * Trip itinerary sequencer.
 *
 * Given a set of assessed trails for a destination, produces a
 * day-by-day plan across the trip window. Deterministic; no LLM
 * involved. The goal is a sensible default the user tweaks manually,
 * not a perfect plan.
 *
 * Heuristics:
 *   - Only READY + ACHIEVABLE trails go in the pool (skip HARD +
 *     DO_NOT_ATTEMPT unless the pool is otherwise empty).
 *   - Day 1 (arrival) prefers a shorter warmup (< 5h).
 *   - Last day prefers something shorter too (travel logistics).
 *   - Middle days get the biggest / most-marquee objectives.
 *   - Rest day inserted after any single hike > 8h, or after 2
 *     consecutive days totaling > 12h.
 *   - No trail repeats.
 */

import type { TrailPreset } from "./trail-library";

// Verdict is a small pure-string union; inline it here so this module
// stays free of trail-assessment's server-only transitive imports
// (drizzle / postgres). Keep in sync with trail-assessment.ts.
export type Verdict = "comfortable" | "achievable" | "hard" | "do_not_attempt";

export type MinimalAssessment = { verdict: Verdict };

export type AssessedPreset = {
  preset: TrailPreset;
  assessment: MinimalAssessment;
};

export type ItineraryDay =
  | {
      kind: "hike";
      dayIndex: number; // 0-based
      dateYmd: string;
      preset: TrailPreset;
      verdict: Verdict;
    }
  | {
      kind: "rest";
      dayIndex: number;
      dateYmd: string;
      reason: string;
    }
  | {
      kind: "unfilled";
      dayIndex: number;
      dateYmd: string;
    };

export type Itinerary = {
  days: ItineraryDay[];
  totalHikes: number;
  totalHours: number;
  totalVerticalFt: number;
};

function isRecommended(verdict: Verdict): boolean {
  return verdict === "comfortable" || verdict === "achievable";
}

function ymdPlus(startYmd: string, offsetDays: number): string {
  const [y, m, d] = startYmd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Pick a trail for a specific day slot from the remaining pool, based on
 * the day's role (arrival / middle / departure). Returns null if pool
 * is exhausted.
 */
function pickForSlot(
  pool: AssessedPreset[],
  role: "arrival" | "middle" | "departure",
  usedSlugs: Set<string>,
): AssessedPreset | null {
  const remaining = pool.filter((p) => !usedSlugs.has(p.preset.slug));
  if (remaining.length === 0) return null;

  if (role === "arrival" || role === "departure") {
    // Prefer < 5h if possible; otherwise the shortest remaining.
    const short = remaining.filter((p) => p.preset.typicalHours < 5);
    const pool2 = short.length > 0 ? short : remaining;
    return pool2.reduce((best, cur) =>
      cur.preset.typicalHours < best.preset.typicalHours ? cur : best,
    );
  }

  // Middle: prefer marquee objectives (longer, more elevation), but from
  // READY/ACHIEVABLE only. Sort by (elevation gain desc, hours desc).
  return remaining.reduce((best, cur) => {
    const curScore =
      cur.preset.elevationGainFt * 1000 + cur.preset.typicalHours;
    const bestScore =
      best.preset.elevationGainFt * 1000 + best.preset.typicalHours;
    return curScore > bestScore ? cur : best;
  });
}

export type DayOverride = { kind: "rest" } | { kind: "slug"; slug: string };
export type Overrides = Record<number, DayOverride | undefined>;

export function buildItinerary({
  matched,
  startDateYmd,
  days,
  includeStretch = false,
  overrides = {},
}: {
  matched: AssessedPreset[];
  startDateYmd: string;
  days: number; // 1-14
  includeStretch?: boolean;
  // Per-dayIndex user overrides. 'rest' forces rest. 'slug' forces the
  // named trail from the matched pool. Anything else is auto-picked.
  overrides?: Overrides;
}): Itinerary {
  const boundedDays = Math.max(1, Math.min(14, days));

  // Pool for AUTO picks: recommended (READY / ACHIEVABLE), plus HARD if
  // includeStretch. Overrides can pull from ANY matched trail regardless
  // of verdict — user knows what they're doing.
  const primary = matched.filter((m) => isRecommended(m.assessment.verdict));
  const stretch = matched.filter((m) => m.assessment.verdict === "hard");
  const autoPool = includeStretch ? [...primary, ...stretch] : primary;
  const matchedBySlug = new Map(matched.map((m) => [m.preset.slug, m]));

  // Pre-mark all overridden slugs as used so auto-pick doesn't duplicate.
  const used = new Set<string>();
  for (let i = 0; i < boundedDays; i++) {
    const ov = overrides[i];
    if (ov?.kind === "slug") used.add(ov.slug);
  }

  const dayList: ItineraryDay[] = [];
  let totalHours = 0;
  let totalVert = 0;
  let hikeCount = 0;
  let prevWasHike = false;
  let prevHikeHours = 0;

  for (let i = 0; i < boundedDays; i++) {
    const dateYmd = ymdPlus(startDateYmd, i);
    const ov = overrides[i];

    // Override: force rest.
    if (ov?.kind === "rest") {
      dayList.push({
        kind: "rest",
        dayIndex: i,
        dateYmd,
        reason: "Rest day — hydrate, mobilize, eat well.",
      });
      prevWasHike = false;
      prevHikeHours = 0;
      continue;
    }

    // Override: force a specific hike.
    if (ov?.kind === "slug") {
      const forced = matchedBySlug.get(ov.slug);
      if (forced) {
        dayList.push({
          kind: "hike",
          dayIndex: i,
          dateYmd,
          preset: forced.preset,
          verdict: forced.assessment.verdict,
        });
        totalHours += forced.preset.typicalHours;
        totalVert += forced.preset.elevationGainFt;
        hikeCount++;
        prevWasHike = true;
        prevHikeHours = forced.preset.typicalHours;
        continue;
      }
      // Fall through to auto-pick if the override slug isn't in the pool
      // (can happen if user changed destination while overrides persisted).
    }

    // Auto: rest-day trigger — previous day was a big hike (>8h) OR
    // >6h. Only when more days coming.
    const needsRest =
      prevWasHike && prevHikeHours > 6 && i < boundedDays - 1;
    if (needsRest) {
      dayList.push({
        kind: "rest",
        dayIndex: i,
        dateYmd,
        reason:
          prevHikeHours > 8
            ? "Yesterday was a long day — take a proper recovery day."
            : "Rest between efforts. Walk, hydrate, snack.",
      });
      prevWasHike = false;
      prevHikeHours = 0;
      continue;
    }

    const role: "arrival" | "middle" | "departure" =
      i === 0 && boundedDays > 1
        ? "arrival"
        : i === boundedDays - 1 && boundedDays > 1
          ? "departure"
          : "middle";
    const pick = pickForSlot(autoPool, role, used);
    if (!pick) {
      dayList.push({ kind: "unfilled", dayIndex: i, dateYmd });
      prevWasHike = false;
      prevHikeHours = 0;
      continue;
    }

    used.add(pick.preset.slug);
    dayList.push({
      kind: "hike",
      dayIndex: i,
      dateYmd,
      preset: pick.preset,
      verdict: pick.assessment.verdict,
    });
    totalHours += pick.preset.typicalHours;
    totalVert += pick.preset.elevationGainFt;
    hikeCount++;
    prevWasHike = true;
    prevHikeHours = pick.preset.typicalHours;
  }

  return {
    days: dayList,
    totalHikes: hikeCount,
    totalHours: Math.round(totalHours * 10) / 10,
    totalVerticalFt: totalVert,
  };
}
