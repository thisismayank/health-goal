/**
 * Detraining decay model.
 *
 * The verdict engine already reads recent workout volume, so someone
 * who stops training sees numbers drift down as workouts age out of
 * the 60-day window. That's implicit and slow. This module makes the
 * loss *explicit* per dimension, on the right biological timescale,
 * so we can surface "you're 8 days off; endurance is down ~14%" as a
 * first-class Home signal.
 *
 * Shape: loss(days) = coeff × √days, capped by a per-dim floor.
 * The sqrt curve matches subjective experience — first week off costs
 * more per-day than week four. Coefficients are the pragmatic
 * synthesis of common detraining literature (see project notes):
 *
 *   - Aerobic:   Coyle '84 plasma volume −12% in 8d; VO2max −7% in
 *                12d, −17% in 4wk, −25% in 8wk (trained subjects).
 *                Coeff 0.05 → ~14% at 8d, ~19% at 14d, ~26% at 28d.
 *   - Vertical:  Aerobic + local leg endurance; slightly slower.
 *   - Pack:      Strength — neural retained 2-4wk, hypertrophy 4-8wk.
 *                Coeff 0.02 → ~6% at 8d, ~11% at 28d, ~15% at 60d.
 *   - Altitude:  Ventilatory acclimatization decays within 1-2wk after
 *                descent. Coeff 0.07 → ~20% at 8d, floor 80% loss at
 *                the outer bound (any acclimatization credit is
 *                effectively gone by 3-4 weeks off the mountain).
 *
 * Recovery is deliberately NOT modeled here — rest tends to *raise*
 * HRV/lower RHR, not degrade them. The recovery analyzer handles that
 * already.
 */

import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { workout } from "@/db/schema";

export type DecayDim = "aerobic" | "vertical" | "pack" | "altitude";

const COEFF: Record<DecayDim, number> = {
  aerobic: 0.05,
  vertical: 0.04,
  pack: 0.02,
  altitude: 0.07,
};

const FLOOR_LOSS: Record<DecayDim, number> = {
  aerobic: 0.4,
  vertical: 0.4,
  pack: 0.25,
  altitude: 0.8,
};

// Which workout categories count as "training this dimension." Used
// to compute daysSinceLast per dim. A user who ran but never lifted
// still shows pack decay from days-since-last-strength.
const CATEGORIES: Record<DecayDim, string[]> = {
  aerobic: [
    "EASY_RUN",
    "QUALITY_RUN",
    "ZONE2_CARDIO",
    "STAIRMASTER",
    "INCLINE_TREADMILL",
    "OUTDOOR_HIKE",
    "LOADED_HIKE",
    "LONG_MOUNTAIN_SESSION",
  ],
  vertical: [
    "STAIRMASTER",
    "INCLINE_TREADMILL",
    "OUTDOOR_HIKE",
    "LOADED_HIKE",
    "LONG_MOUNTAIN_SESSION",
  ],
  pack: ["FULL_BODY_STRENGTH", "LOADED_HIKE", "LONG_MOUNTAIN_SESSION"],
  altitude: ["OUTDOOR_HIKE", "LOADED_HIKE", "LONG_MOUNTAIN_SESSION"],
};

/**
 * Pure retention curve. Given days since the dim was last trained,
 * return the fraction of peak capacity retained.
 */
export function retentionAfterDays(
  dim: DecayDim,
  days: number,
): { lossPct: number; retentionPct: number } {
  if (!Number.isFinite(days) || days <= 0) {
    return { lossPct: 0, retentionPct: 1 };
  }
  const raw = COEFF[dim] * Math.sqrt(days);
  const lossPct = Math.min(FLOOR_LOSS[dim], raw);
  return { lossPct, retentionPct: 1 - lossPct };
}

export type DimDecay = {
  dim: DecayDim;
  daysSinceLast: number | null; // null if no relevant workout on record
  lossPct: number;
  retentionPct: number;
};

export type DecayState = {
  // Total days since ANY qualifying workout. Drives whether to
  // surface the idle banner at all.
  idleDays: number | null;
  dims: DimDecay[];
  // Days until altitude ventilatory credit is effectively gone (from
  // last altitude-touching workout). null if no altitude workout on
  // record. Used for the "altitude window closes in Nd" callout.
  altitudeWindowDaysLeft: number | null;
};

/**
 * Compute the decay state for a user as of `now`. Runs a single
 * grouped query — for each dim, we find the most recent workout in
 * any of its qualifying categories, take the delta in days, feed it
 * to the retention curve.
 */
export async function computeDecayState(
  userId: number,
  now: Date,
): Promise<DecayState> {
  // Union of every category we care about — one small query.
  const allCats = Array.from(
    new Set(Object.values(CATEGORIES).flat()),
  );
  const rows = await db
    .select({
      type: workout.type,
      startTime: workout.startTime,
    })
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        inArray(workout.type, allCats),
        lte(workout.startTime, now),
      ),
    )
    .orderBy(desc(workout.startTime));

  const daysBetween = (then: Date): number =>
    Math.floor((now.getTime() - then.getTime()) / 86_400_000);

  // idleDays = days since ANY qualifying workout
  const idleDays = rows.length > 0 ? daysBetween(rows[0].startTime) : null;

  const dims: DimDecay[] = (Object.keys(CATEGORIES) as DecayDim[]).map(
    (dim) => {
      const cats = new Set(CATEGORIES[dim]);
      const first = rows.find((r) => cats.has(r.type));
      if (!first) {
        return { dim, daysSinceLast: null, lossPct: 0, retentionPct: 1 };
      }
      const days = daysBetween(first.startTime);
      const { lossPct, retentionPct } = retentionAfterDays(dim, days);
      return { dim, daysSinceLast: days, lossPct, retentionPct };
    },
  );

  // Altitude ventilatory credit is effectively spent by ~14 days off
  // any elevation-touching activity. Communicate the remaining runway
  // so users can time a rebuild hike before it's gone.
  const altDaysSince =
    dims.find((d) => d.dim === "altitude")?.daysSinceLast ?? null;
  const altitudeWindowDaysLeft =
    altDaysSince == null ? null : Math.max(0, 14 - altDaysSince);

  return { idleDays, dims, altitudeWindowDaysLeft };
}
