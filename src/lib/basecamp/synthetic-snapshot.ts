/**
 * Build a FitnessSnapshot from a stranger's 3-question self-report
 * so the cold-start /start flow can run assessTrail() before the
 * user has signed up (and therefore has no workouts, no daily
 * metrics, no plan). Same shape assessTrail expects — every field
 * downstream analyzers read is populated conservatively.
 *
 * Design intent: the answers should over-report data honestly and
 * under-report data we don't have. Weekly aerobic minutes come from
 * a self-reported bucket, so we don't need to fabricate workouts;
 * altitude uses the user's own prior-high answer directly. Pack
 * signals return null → analyzePack surfaces UNKNOWN, not a fake
 * score. That's the whole point of the UNKNOWN path — a stranger
 * with no strength data shouldn't be told they're ready to carry
 * 35 lb.
 */

import type { FitnessSnapshot } from "./trail-assessment";

export type ColdStartAnswers = {
  /** Longest single hike in the past year — bucketed by hours. */
  longestHikeBucket: "never" | "under_3" | "3_to_6" | "6_to_10" | "over_10";
  /** Current training hours per week (any moderate cardio counts). */
  weeklyHoursBucket: "zero" | "1_to_3" | "3_to_6" | "over_6";
  /** Highest altitude reached in the past ~year. */
  priorAltBucket: "never_above_6k" | "to_8_10k" | "to_12_14k" | "above_14k";
  bodyweightKg?: number | null;
};

// Bucket-to-value maps. Chosen from the lower half of the bucket
// range so we don't overstate the user's baseline. E.g. "3-6h longest
// hike" → 240 minutes (4h), not 360.
const LONGEST_HIKE_MIN: Record<ColdStartAnswers["longestHikeBucket"], number> = {
  never: 0,
  under_3: 90,
  "3_to_6": 240,
  "6_to_10": 420,
  over_10: 660,
};

const WEEKLY_HOURS_MIN: Record<ColdStartAnswers["weeklyHoursBucket"], number> = {
  zero: 0,
  "1_to_3": 90, // ~1.5 hours/wk
  "3_to_6": 240,
  over_6: 420, // ~7 hours/wk
};

const PRIOR_ALT_FT: Record<ColdStartAnswers["priorAltBucket"], number | null> = {
  never_above_6k: null, // treat as no altitude history
  to_8_10k: 9000,
  to_12_14k: 13000,
  above_14k: 15000,
};

export function synthSnapshot(answers: ColdStartAnswers): FitnessSnapshot {
  const longestRecentSessionMin = LONGEST_HIKE_MIN[answers.longestHikeBucket];
  const weeklyAerobicMinutes = WEEKLY_HOURS_MIN[answers.weeklyHoursBucket];
  const maxAltitudeReachedFt = PRIOR_ALT_FT[answers.priorAltBucket];

  return {
    longestRecentSessionMin,
    weeklyAerobicMinutes,
    // Vertical: derive a plausible-max per session from longest hike
    // time × a moderate ~500 ft/h ascent rate. If they've never hiked,
    // stays at zero and the vertical analyzer will say so.
    maxSingleSessionVertFt: Math.round(
      (longestRecentSessionMin / 60) * 500,
    ),
    // Cumulative 90d: rough — weekly aerobic hours × 13 weeks × the
    // same 500 ft/h heuristic. Only used for one long-range vertical
    // signal, not verdicts on its own.
    cumulative90dVertFt: Math.round(
      (weeklyAerobicMinutes / 60) * 13 * 500,
    ),
    // Pack signal is intentionally absent — a stranger's self-report
    // can't distinguish "carried 20 lb once" from "trained under load."
    // analyzePack will return UNKNOWN, which surfaces "log squats or
    // complete a loaded hike" copy in the verdict card. That's the
    // right prompt for a new user.
    maxPackLb: 0,
    maxAltitudeReachedFt,
    // Recovery signals: cold-start has no wearable data. Analyzers
    // require baseline presence to score; both baselines null →
    // analyzeRecovery returns UNKNOWN, which we surface honestly.
    rhr: {
      baseline: null,
      current: null,
      deltaAbs: null,
      deltaPct: null,
      windowDays: 0,
      samples: 0,
    },
    hrv: {
      baseline: null,
      current: null,
      deltaAbs: null,
      deltaPct: null,
      windowDays: 0,
      samples: 0,
    },
    sleepAvgHours: null,
    vo2Max: null,
    squatEst1RmKg: null,
    loadedHikes8w: 0,
    bodyweightKg: answers.bodyweightKg ?? null,
  };
}
