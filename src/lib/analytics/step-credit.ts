/**
 * Ambient-step aerobic credit.
 *
 * Product intent (Mayank, 2026-08-24): "I am doing 15-20k steps
 * every day but not recording all of them as workouts — they are
 * just steps. Do you think they should also account for some form
 * of activity towards my final goal?"
 *
 * Yes. Sustained ambient walking is a real aerobic base
 * contribution. This helper turns dailyMetric.steps into implied
 * moderate-walking minutes so the endurance stat + trail-assessment
 * verdict see the effort — instead of scoring a 20k-step day as
 * zero because no workout was logged.
 *
 * Model:
 *   - 100 steps ≈ 1 minute of moderate walking (~5 km/h cadence)
 *   - Only steps ABOVE a baseline (5000/day) count as "aerobic" —
 *     the first 5k is baseline daily-life movement that's already
 *     assumed and shouldn't inflate scores for a desk worker who
 *     commutes 6k steps.
 *   - Per-day cap of 90 min so a marathon-runner day doesn't
 *     double-count via steps (their workout is already logged).
 */

import { and, eq, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";
import { ymd } from "@/lib/date";

const STEP_BASELINE = 5000;
const STEPS_PER_MINUTE = 100;
const PER_DAY_CAP_MIN = 90;

/**
 * Weekly minutes of aerobic credit from ambient steps over the
 * given window. Returns 0 when the user has no step data — the
 * app degrades gracefully to just-workouts scoring.
 */
export async function stepAerobicMinutesPerWeek(input: {
  userId: number;
  windowDays: number;
  now: Date;
}): Promise<number> {
  const start = new Date(
    input.now.getTime() - input.windowDays * 86400 * 1000,
  );
  const rows = await db
    .select({ date: dailyMetric.date, steps: dailyMetric.steps })
    .from(dailyMetric)
    .where(
      and(
        eq(dailyMetric.userId, input.userId),
        gte(dailyMetric.date, ymd(start)),
        lte(dailyMetric.date, ymd(input.now)),
        isNotNull(dailyMetric.steps),
      ),
    );
  if (rows.length === 0) return 0;

  const totalMinutes = rows.reduce((sum, r) => {
    const s = r.steps ?? 0;
    const above = Math.max(0, s - STEP_BASELINE);
    const min = Math.min(PER_DAY_CAP_MIN, above / STEPS_PER_MINUTE);
    return sum + min;
  }, 0);

  const weeks = input.windowDays / 7;
  return totalMinutes / weeks;
}

/**
 * Recent step summary for surfaces that want to show "you walked X
 * today, that's Y aerobic minutes." Returns per-day rows sorted
 * newest first, capped at `limit`.
 */
export async function recentDailySteps(
  userId: number,
  now: Date,
  limit = 7,
): Promise<Array<{ date: string; steps: number; aerobicMinutes: number }>> {
  const start = new Date(now.getTime() - limit * 86400 * 1000);
  const rows = await db
    .select({ date: dailyMetric.date, steps: dailyMetric.steps })
    .from(dailyMetric)
    .where(
      and(
        eq(dailyMetric.userId, userId),
        gte(dailyMetric.date, ymd(start)),
        isNotNull(dailyMetric.steps),
      ),
    );
  return rows
    .filter((r): r is { date: string; steps: number } => r.steps != null)
    .map((r) => {
      const above = Math.max(0, r.steps - STEP_BASELINE);
      const min = Math.min(PER_DAY_CAP_MIN, above / STEPS_PER_MINUTE);
      return {
        date: r.date,
        steps: r.steps,
        aerobicMinutes: Math.round(min),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}
