/**
 * Cold-start baseline: derive a low-confidence FitnessSnapshot layer +
 * an unverified Hiker Class from the three /start answers, then merge
 * both into the DB-derived state at assessment time.
 *
 * Devin's Reddit-launch test caught the failure mode this fixes: pre-
 * signup the verdict engine sees a rich synthSnapshot(answers); post-
 * signup it loads from the workout table which is empty for a fresh
 * user, and the verdict silently degrades. Every stranger who signed
 * up got told they were worse than what they saw on /start.
 *
 * Design:
 *   - Answers are a permanent per-dimension FLOOR, not a decaying
 *     override. Real workout data always wins where it exists
 *     (measured max/sum overtakes baseline max naturally).
 *   - Self-report NEVER awards READY on consequential dims
 *     (altitude, terrain). It reaches "plausible/unverified", which
 *     shows as UNKNOWN — doesn't cap the verdict downward but also
 *     doesn't hand out safety-critical green lights the user hasn't
 *     earned.
 *   - Class inference caps at C. B/A imply verified mountaineering
 *     skills (rope work, glacier travel) that no 3-question bucket
 *     can prove.
 */

import type { ColdStartAnswers } from "./synthetic-snapshot";

export const COLD_START_CLASS_CAP = 2; // C

/**
 * Map the three answers to a Hiker Class index (0=E, 1=D, 2=C, ...).
 * Caps at C — see file header.
 *
 * Scoring is additive across three axes so partial credit accumulates.
 * A near-perfect answer set lands at C; a middle-of-the-road one at D;
 * a truly novice one at E.
 */
export function classFromColdStartAnswers(
  answers: ColdStartAnswers,
): number {
  const longestScore =
    answers.longestHikeBucket === "over_10"
      ? 3
      : answers.longestHikeBucket === "6_to_10"
        ? 2
        : answers.longestHikeBucket === "3_to_6"
          ? 1
          : 0;
  const weeklyScore =
    answers.weeklyHoursBucket === "over_6"
      ? 3
      : answers.weeklyHoursBucket === "3_to_6"
        ? 2
        : answers.weeklyHoursBucket === "1_to_3"
          ? 1
          : 0;
  const altScore =
    answers.priorAltBucket === "above_14k"
      ? 3
      : answers.priorAltBucket === "to_12_14k"
        ? 2
        : answers.priorAltBucket === "to_8_10k"
          ? 1
          : 0;
  const total = longestScore + weeklyScore + altScore;
  // 0-2 → E, 3-4 → D, 5+ → C. Never above C from self-report alone.
  const index = total >= 5 ? 2 : total >= 3 ? 1 : 0;
  return Math.min(COLD_START_CLASS_CAP, index);
}
