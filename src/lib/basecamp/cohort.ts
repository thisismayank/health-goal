/**
 * Cohort ranking — where the user stands this week within their Hiker
 * Class cohort. Anonymous, no leaderboard list, just a percentile hint
 * on the Weekly Quest card.
 *
 * Score = normalized effort against the class's weekly targets. Same
 * targets as Weekly Quest so ranking + progress bar are consistent.
 *
 * Cohort < COHORT_MIN_SIZE returns null — too noisy + risks
 * de-anonymizing users when the pool is tiny.
 */

import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile, workout } from "@/db/schema";
import { parseYmd, todayInTimeZone, weekDays, weekStart } from "@/lib/date";
import { WEEKLY_TARGETS } from "./weekly-quest";
import { type Rank } from "./rank";

const COHORT_MIN_SIZE = 5;

export type CohortResult = {
  kind: "ranked";
  cohortClass: Rank;
  cohortSize: number;
  yourRank: number; // 1 = best
  yourPercentile: number; // 0–100, higher = better
  yourScore: number; // 0–1
} | {
  kind: "too_small";
  cohortClass: Rank;
  cohortSize: number;
};

function scoreFor({
  workouts,
  minutes,
  targets,
}: {
  workouts: number;
  minutes: number;
  targets: { workouts: number; minutes: number };
}): number {
  const w =
    targets.workouts <= 0 ? 0 : Math.min(1, workouts / targets.workouts);
  const m = targets.minutes <= 0 ? 0 : Math.min(1, minutes / targets.minutes);
  return (w + m) / 2;
}

/**
 * Rank the current user within their Hiker Class cohort by their weekly
 * effort score. Batched: one aggregate query per cohort — safe up to
 * ~1000 users, add caching later if we scale further.
 */
export async function getCohortRank(
  currentUserId: number,
  currentUserClass: Rank,
  tz: string,
): Promise<CohortResult | null> {
  const todayYmd = todayInTimeZone(tz);
  const anchor = parseYmd(todayYmd);
  const days = weekDays(anchor);
  const startDate = weekStart(anchor);
  const endDate = new Date(days[6]);
  endDate.setHours(23, 59, 59, 999);

  // Aggregate weekly workouts per user in the same class. Uses lastKnownClass
  // as the cohort key — set at each home visit + on class-up transitions.
  const rows = await db
    .select({
      userId: userProfile.id,
      workouts: sql<number>`COUNT(${workout.id})::int`.as("workouts"),
      durationSec:
        sql<number>`COALESCE(SUM(${workout.durationSeconds}), 0)::int`.as(
          "duration_sec",
        ),
    })
    .from(userProfile)
    .leftJoin(
      workout,
      and(
        eq(workout.userId, userProfile.id),
        gte(workout.startTime, startDate),
        lte(workout.startTime, endDate),
      ),
    )
    .where(
      and(
        isNotNull(userProfile.lastKnownClass),
        eq(userProfile.lastKnownClass, currentUserClass),
      ),
    )
    .groupBy(userProfile.id);

  const cohortSize = rows.length;
  if (cohortSize < COHORT_MIN_SIZE) {
    return { kind: "too_small", cohortClass: currentUserClass, cohortSize };
  }

  const targets = WEEKLY_TARGETS[currentUserClass];
  const scored = rows
    .map((r) => ({
      userId: r.userId,
      score: scoreFor({
        workouts: r.workouts,
        minutes: Math.round(r.durationSec / 60),
        targets,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const idx = scored.findIndex((s) => s.userId === currentUserId);
  if (idx === -1) {
    // Shouldn't happen — user should be in their own cohort — but bail
    // gracefully if lastKnownClass is briefly out of sync.
    return null;
  }
  const yourRank = idx + 1;
  // Percentile: percent of cohort you're at least as good as. Higher =
  // better. If you're rank 1 of 20, you're better than 19/20 = 95%.
  const yourPercentile = Math.round(
    ((cohortSize - yourRank) / Math.max(1, cohortSize - 1)) * 100,
  );

  return {
    kind: "ranked",
    cohortClass: currentUserClass,
    cohortSize,
    yourRank,
    yourPercentile,
    yourScore: scored[idx].score,
  };
}

/**
 * Human-facing label for a percentile: 'Top 10%' / 'Top 25%' / 'Top 50%'
 * / 'Middle 50%' / 'Bottom 50%'. Keeps the framing positive (or neutral).
 */
export function percentileLabel(percentile: number): string {
  if (percentile >= 90) return "Top 10%";
  if (percentile >= 75) return "Top 25%";
  if (percentile >= 50) return "Top 50%";
  if (percentile >= 25) return "Middle of the pack";
  return "Building up — keep going";
}
