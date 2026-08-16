import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workout, type Workout } from "@/db/schema";

export type Waypoint = {
  name: string;
  ft: number;
  description: string;
};

export const RAINIER_SUMMIT_FT = 14411;

// Named waypoints along the actual Muir route on Mount Rainier.
export const WAYPOINTS: Waypoint[] = [
  { name: "Paradise", ft: 5400, description: "Trailhead" },
  { name: "Camp Muir", ft: 10188, description: "First high camp" },
  { name: "Ingraham Flats", ft: 11000, description: "Approach to Cleaver" },
  { name: "Disappointment Cleaver", ft: 12300, description: "Route crux" },
  { name: "Summit", ft: RAINIER_SUMMIT_FT, description: "Columbia Crest" },
];

export type SummitProgress = {
  totalFt: number;
  currentWaypoint: Waypoint | null;
  nextWaypoint: Waypoint | null;
  toNextFt: number;
  summitCount: number; // 0 = not yet, 1 = one Rainier climbed, 2 = second, ...
  fractionThroughCurrent: number; // 0-1 through the current mountain
};

export function summitProgressFor(totalFt: number): SummitProgress {
  const perMountain = RAINIER_SUMMIT_FT;
  const summitCount = Math.floor(totalFt / perMountain);
  const remainderFt = totalFt % perMountain;

  const belowRemainder = WAYPOINTS.filter((w) => w.ft <= remainderFt);
  const aboveRemainder = WAYPOINTS.filter((w) => w.ft > remainderFt);

  const current = belowRemainder.at(-1) ?? null;
  const next = aboveRemainder[0] ?? null;

  return {
    totalFt,
    currentWaypoint: current,
    nextWaypoint: next,
    toNextFt: next ? next.ft - remainderFt : 0,
    summitCount,
    fractionThroughCurrent: Math.min(1, remainderFt / perMountain),
  };
}

export function metersToFeet(m: number): number {
  return Math.round(m * 3.281);
}

// --- Effective vertical estimation ---
// Real GPS elevation isn't recorded for indoor cardio (treadmill, stair
// stepper) or for GPS-off strength sessions. We estimate vertical for the
// two cardio-indoor categories that meaningfully generate it. Formulas
// are deliberately transparent — easy to tune.

const DEFAULT_TREADMILL_INCLINE_FRACTION = 0.12; // 12% (mid-range treadmill max)
const DEFAULT_TREADMILL_SPEED_MPS = 1.33; // ~4.8 km/h — brisk incline walking
const STAIR_STEPPER_METERS_PER_MIN = 10; // ~33 ft/min, moderate rate
const REAL_GPS_MIN_METERS = 5; // below this, treat GPS as "no signal"

// A workout row from Strava that we may need to enrich.
type WorkoutForEstimate = Pick<
  Workout,
  "type" | "durationSeconds" | "distanceMeters" | "elevationGainMeters"
>;

export function estimatedVerticalMeters(w: WorkoutForEstimate): {
  meters: number;
  source: "gps" | "treadmill_estimate" | "stair_estimate" | "none";
} {
  const gps = w.elevationGainMeters ?? 0;
  if (gps > REAL_GPS_MIN_METERS) {
    return { meters: gps, source: "gps" };
  }
  const durationMin = (w.durationSeconds ?? 0) / 60;
  const distanceM = w.distanceMeters ?? 0;

  if (w.type === "INCLINE_TREADMILL") {
    // Prefer distance × incline; if no distance recorded, estimate distance
    // from duration at typical incline-walking pace.
    const effectiveDistance =
      distanceM > 0
        ? distanceM
        : durationMin * 60 * DEFAULT_TREADMILL_SPEED_MPS;
    const meters = effectiveDistance * DEFAULT_TREADMILL_INCLINE_FRACTION;
    return { meters, source: "treadmill_estimate" };
  }

  if (w.type === "STAIRMASTER") {
    return {
      meters: durationMin * STAIR_STEPPER_METERS_PER_MIN,
      source: "stair_estimate",
    };
  }

  return { meters: 0, source: "none" };
}

export type VerticalBreakdown = {
  totalFt: number;
  gpsFt: number;
  estimatedFt: number;
};

export async function getCumulativeVertical(
  userId: number,
): Promise<VerticalBreakdown> {
  const rows = await db
    .select({
      type: workout.type,
      durationSeconds: workout.durationSeconds,
      distanceMeters: workout.distanceMeters,
      elevationGainMeters: workout.elevationGainMeters,
    })
    .from(workout)
    .where(eq(workout.userId, userId));

  let gpsM = 0;
  let estimatedM = 0;
  for (const w of rows) {
    const { meters, source } = estimatedVerticalMeters(w);
    if (source === "gps") gpsM += meters;
    else estimatedM += meters;
  }
  return {
    totalFt: metersToFeet(gpsM + estimatedM),
    gpsFt: metersToFeet(gpsM),
    estimatedFt: metersToFeet(estimatedM),
  };
}

// Convenience: total-ft only, matches the old API used by the completion
// summary and legacy call sites.
export async function getCumulativeVerticalFt(userId: number): Promise<number> {
  const { totalFt } = await getCumulativeVertical(userId);
  return totalFt;
}
