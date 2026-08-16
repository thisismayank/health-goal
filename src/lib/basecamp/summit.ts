import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { workout } from "@/db/schema";

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

export async function getCumulativeVerticalFt(userId: number): Promise<number> {
  const [row] = await db
    .select({
      totalMeters: sql<number>`COALESCE(SUM(elevation_gain_meters), 0)::real`,
    })
    .from(workout)
    .where(eq(workout.userId, userId));
  return Math.round((row?.totalMeters ?? 0) * 3.281);
}

export function metersToFeet(m: number): number {
  return Math.round(m * 3.281);
}
