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

export function mapStravaType(sportType: string, type: string): SessionCategory {
  return STRAVA_TYPE_MAP[sportType] ?? STRAVA_TYPE_MAP[type] ?? "CROSS_TRAINING";
}
