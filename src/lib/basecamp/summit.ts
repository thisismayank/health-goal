import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, workout, type Trail, type Workout } from "@/db/schema";

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

// Waypoints for well-known objectives when they're set as primary goal.
// If a trail has no preset waypoints, fall back to generic 25/50/75/100 %
// milestones of its summit height.
export const PRESET_WAYPOINTS: Record<string, Waypoint[]> = {
  "rainier-dc": WAYPOINTS,
  "rainier-emmons": WAYPOINTS,
  "kilimanjaro-machame": [
    { name: "Machame Gate", ft: 5900, description: "Trailhead" },
    { name: "Shira Camp 2", ft: 12500, description: "Day 3" },
    { name: "Barranco Camp", ft: 13100, description: "Day 4" },
    { name: "Barafu Camp", ft: 15300, description: "High camp" },
    { name: "Uhuru Peak", ft: 19341, description: "Summit" },
  ],
  "kilimanjaro-lemosho": [
    { name: "Lemosho Gate", ft: 7700, description: "Trailhead" },
    { name: "Shira Camp 2", ft: 12500, description: "Day 4" },
    { name: "Barranco Camp", ft: 13100, description: "Day 5" },
    { name: "Barafu Camp", ft: 15300, description: "High camp" },
    { name: "Uhuru Peak", ft: 19341, description: "Summit" },
  ],
  "denali-west-buttress": [
    { name: "Basecamp", ft: 7200, description: "Kahiltna Glacier" },
    { name: "Camp 2", ft: 11200, description: "Motorcycle Hill" },
    { name: "Camp 3 (14 Camp)", ft: 14200, description: "Medical station" },
    { name: "High Camp", ft: 17200, description: "West Buttress" },
    { name: "Summit", ft: 20310, description: "Denali" },
  ],
  "ebc-trek": [
    { name: "Lukla", ft: 9300, description: "Trailhead" },
    { name: "Namche Bazaar", ft: 11290, description: "Sherpa capital" },
    { name: "Dingboche", ft: 14470, description: "Acclimatization" },
    { name: "Lobuche", ft: 16110, description: "" },
    { name: "Everest BC / Kala Patthar", ft: 18192, description: "Trek high point" },
  ],
  "aconcagua-normal": [
    { name: "Confluencia", ft: 11150, description: "Day 1" },
    { name: "Plaza de Mulas (BC)", ft: 14340, description: "Basecamp" },
    { name: "Nido de Cóndores", ft: 18300, description: "Camp 2" },
    { name: "Cólera / Berlin", ft: 19700, description: "High camp" },
    { name: "Summit", ft: 22841, description: "Cerro Aconcagua" },
  ],
  "elbrus-south": [
    { name: "Azau", ft: 7550, description: "Trailhead" },
    { name: "Barrels Hut", ft: 12500, description: "Cable car end" },
    { name: "Pastukhov Rocks", ft: 15400, description: "Snowcat drop" },
    { name: "Saddle", ft: 17700, description: "West-East saddle" },
    { name: "West Summit", ft: 18510, description: "Highest point Europe" },
  ],
};

export function genericWaypoints(summitFt: number): Waypoint[] {
  return [
    { name: "1/4", ft: Math.round(summitFt * 0.25), description: "" },
    { name: "Halfway", ft: Math.round(summitFt * 0.5), description: "" },
    { name: "3/4", ft: Math.round(summitFt * 0.75), description: "" },
    { name: "Summit", ft: summitFt, description: "Goal" },
  ];
}

export type ActiveGoal = {
  source: "primary_trail" | "default_rainier";
  name: string;
  summitFt: number;
  waypoints: Waypoint[];
  primaryTrailId: number | null;
};

const DEFAULT_GOAL: ActiveGoal = {
  source: "default_rainier",
  name: "Mount Rainier",
  summitFt: RAINIER_SUMMIT_FT,
  waypoints: WAYPOINTS,
  primaryTrailId: null,
};

function goalFromTrail(t: Trail): ActiveGoal {
  const summitFt = t.maxAltitudeFt;
  const presetWaypoints = t.presetSlug ? PRESET_WAYPOINTS[t.presetSlug] : null;
  return {
    source: "primary_trail",
    name: t.name,
    summitFt,
    waypoints: presetWaypoints ?? genericWaypoints(summitFt),
    primaryTrailId: t.id,
  };
}

export async function getActiveGoal(userId: number): Promise<ActiveGoal> {
  const [primary] = await db
    .select()
    .from(trail)
    .where(and(eq(trail.userId, userId), eq(trail.isPrimary, true)))
    .limit(1);
  if (!primary) return DEFAULT_GOAL;
  return goalFromTrail(primary);
}

export type SummitProgress = {
  totalFt: number;
  currentWaypoint: Waypoint | null;
  nextWaypoint: Waypoint | null;
  toNextFt: number;
  summitCount: number; // 0 = not yet, 1 = one Rainier climbed, 2 = second, ...
  fractionThroughCurrent: number; // 0-1 through the current mountain
};

export function summitProgressFor(
  totalFt: number,
  goal: ActiveGoal = DEFAULT_GOAL,
): SummitProgress {
  const perMountain = goal.summitFt;
  const summitCount = Math.floor(totalFt / perMountain);
  const remainderFt = totalFt % perMountain;

  const belowRemainder = goal.waypoints.filter((w) => w.ft <= remainderFt);
  const aboveRemainder = goal.waypoints.filter((w) => w.ft > remainderFt);

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
  opts?: { excludeWorkoutIds?: number[] },
): Promise<VerticalBreakdown> {
  const excludes = opts?.excludeWorkoutIds ?? [];
  const rows = await db
    .select({
      type: workout.type,
      durationSeconds: workout.durationSeconds,
      distanceMeters: workout.distanceMeters,
      elevationGainMeters: workout.elevationGainMeters,
    })
    .from(workout)
    .where(
      excludes.length > 0
        ? and(eq(workout.userId, userId), notInArray(workout.id, excludes))
        : eq(workout.userId, userId),
    );

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
