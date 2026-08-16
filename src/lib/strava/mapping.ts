import type { SessionCategory } from "@/db/schema";

const STRAVA_TYPE_MAP: Record<string, SessionCategory> = {
  Run: "EASY_RUN",
  TrailRun: "EASY_RUN",
  VirtualRun: "EASY_RUN",
  Hike: "OUTDOOR_HIKE",
  Walk: "ACTIVE_RECOVERY",
  Ride: "CROSS_TRAINING",
  VirtualRide: "CROSS_TRAINING",
  EBikeRide: "CROSS_TRAINING",
  Handcycle: "CROSS_TRAINING",
  StairStepper: "STAIRMASTER",
  Elliptical: "ZONE2_CARDIO",
  WeightTraining: "FULL_BODY_STRENGTH",
  Crossfit: "FULL_BODY_STRENGTH",
  Workout: "CROSS_TRAINING",
  Yoga: "MOBILITY",
  Swim: "CROSS_TRAINING",
  AlpineSki: "OUTDOOR_HIKE",
  BackcountrySki: "OUTDOOR_HIKE",
  Snowshoe: "OUTDOOR_HIKE",
};

// Pace boundaries in m/s (average_speed field from Strava).
// 1.9 m/s = ~4.2 mph = ~7 min/km = "brisk walk / very slow jog" boundary.
// 3.0 m/s = ~6.7 mph = ~5:30 min/km = "easy run" starts.
const BRISK_WALK_MPS = 1.9;

// Reclassify below-brisk-walk-pace activities:
// - "Run" at walking pace + significant elevation → INCLINE_TREADMILL or OUTDOOR_HIKE
// - "Walk" with heavy elevation → OUTDOOR_HIKE (upgrade from ACTIVE_RECOVERY)
function paceOverride(
  base: SessionCategory,
  avgSpeedMps: number | null | undefined,
  elevGainM: number | null | undefined,
): SessionCategory {
  if (avgSpeedMps == null) return base;

  const isSlow = avgSpeedMps < BRISK_WALK_MPS;
  const hasElevation = (elevGainM ?? 0) > 60;

  // "Run" at walking pace is not a run.
  if (base === "EASY_RUN" && isSlow) {
    // With elevation gain → outdoor hike; without → probably indoor incline
    // treadmill (which doesn't record elevation) → still mountain work.
    return hasElevation ? "OUTDOOR_HIKE" : "INCLINE_TREADMILL";
  }

  // "Walk" with real elevation gain is a hike, not recovery.
  if (base === "ACTIVE_RECOVERY" && hasElevation && elevGainM! > 150) {
    return "OUTDOOR_HIKE";
  }

  return base;
}

export function mapStravaType(
  sportType: string,
  type: string,
  avgSpeedMps?: number | null,
  elevGainM?: number | null,
): SessionCategory {
  const base =
    STRAVA_TYPE_MAP[sportType] ?? STRAVA_TYPE_MAP[type] ?? "CROSS_TRAINING";
  return paceOverride(base, avgSpeedMps, elevGainM);
}
