/**
 * Weekly Quest — ambient between-trips motivator.
 *
 * Computes this week's actual training load (workouts, minutes, vertical)
 * and compares to a target derived from the user's Hiker Class. Weeks run
 * Mon-Sun in the user's local timezone; resets Monday 00:00 local.
 *
 * Different from Plan Progress: this is a light, always-visible weekly
 * bar for casual users. Plan Progress lives on /progress and reports
 * against the training-plan cadence (currently Rainier prep).
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { workout } from "@/db/schema";
import {
  estimatedVerticalMeters,
  metersToFeet,
} from "@/lib/basecamp/summit";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank, type Rank } from "@/lib/basecamp/rank";
import { parseYmd, todayInTimeZone, weekDays, weekStart, ymd } from "@/lib/date";

export type WeeklyQuestTargets = {
  workouts: number;
  minutes: number;
  verticalFt: number;
};

// User-friendly weekly targets per Hiker Class. Not scientific — tuned so
// they feel achievable at the low end and demanding at the top.
export const WEEKLY_TARGETS: Record<Rank, WeeklyQuestTargets> = {
  E: { workouts: 3, minutes: 90, verticalFt: 500 },
  D: { workouts: 3, minutes: 150, verticalFt: 1000 },
  C: { workouts: 4, minutes: 240, verticalFt: 2500 },
  B: { workouts: 5, minutes: 360, verticalFt: 4000 },
  A: { workouts: 5, minutes: 480, verticalFt: 6500 },
  S: { workouts: 6, minutes: 600, verticalFt: 9000 },
};

export type WeeklyQuestData = {
  weekStartYmd: string; // Mon
  weekEndYmd: string; // Sun
  todayYmd: string;
  daysElapsed: number; // 1-7 (Mon = 1)
  daysRemaining: number; // 0-6
  hikerClass: Rank;
  hikerClassLabel: string;
  targets: WeeklyQuestTargets;
  actual: WeeklyQuestTargets;
};

export async function getWeeklyQuest(
  userId: number,
  tz: string,
): Promise<WeeklyQuestData> {
  const todayYmd = todayInTimeZone(tz);
  const anchor = parseYmd(todayYmd);
  const days = weekDays(anchor);
  const weekStartDate = weekStart(anchor);
  const weekEndDate = new Date(days[6]);
  weekEndDate.setHours(23, 59, 59, 999);

  // Character sheet → class → targets. Small duplicated compute vs
  // StatsStrip on the same page; acceptable for MVP.
  const sheet = await computeCharacterSheet(userId);
  const rank = computeRank(sheet);

  const rows = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        gte(workout.startTime, weekStartDate),
        lte(workout.startTime, weekEndDate),
      ),
    );

  const totalMinutes = rows.reduce(
    (sum, w) => sum + Math.round((w.durationSeconds ?? 0) / 60),
    0,
  );
  const totalVerticalFt = rows.reduce(
    (sum, w) => sum + metersToFeet(estimatedVerticalMeters(w).meters),
    0,
  );

  // 1 = Monday, ..., 7 = Sunday.
  const daysElapsed =
    Math.round((anchor.getTime() - weekStartDate.getTime()) / 86_400_000) + 1;
  const daysRemaining = Math.max(0, 7 - daysElapsed);

  return {
    weekStartYmd: ymd(weekStartDate),
    weekEndYmd: ymd(days[6]),
    todayYmd,
    daysElapsed: Math.max(1, Math.min(7, daysElapsed)),
    daysRemaining,
    hikerClass: rank.current,
    hikerClassLabel: rank.currentLabel,
    targets: WEEKLY_TARGETS[rank.current],
    actual: {
      workouts: rows.length,
      minutes: totalMinutes,
      verticalFt: Math.round(totalVerticalFt),
    },
  };
}
