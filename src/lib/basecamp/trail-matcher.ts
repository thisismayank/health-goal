/**
 * Historical hike matcher — given a synced workout with GPS, find
 * preset trails that might be the same hike. Ranked by:
 *   1. GPS proximity (haversine distance to trailhead)
 *   2. Name fuzzy match (Levenshtein-like)
 *   3. Distance/elevation profile similarity
 *
 * Returns top N candidates so the UI can present a "is this one?"
 * confirmation flow — we never auto-log without user OK.
 */

import type { Workout } from "@/db/schema";
import { getFullTrailLibrary } from "./trail-coords";
import type { TrailPreset } from "./trail-library";

const NEAR_KM = 5; // trailhead radius for a plausible match
const FAR_KM = 15; // outer bound for weaker candidates (bigger parks)

export type TrailMatchCandidate = {
  preset: TrailPreset;
  distanceKm: number; // distance from workout start to trailhead
  nameScore: number; // 0-1 (higher = better match)
  profileScore: number; // 0-1 distance+elevation similarity
  totalScore: number; // combined 0-1
};

export function matchWorkoutToTrails(
  w: Pick<
    Workout,
    "startLat" | "startLng" | "sourceName" | "distanceMeters" | "elevationGainMeters"
  >,
  opts?: { limit?: number; libraryOverride?: TrailPreset[] },
): TrailMatchCandidate[] {
  const library = opts?.libraryOverride ?? getFullTrailLibrary();
  const limit = opts?.limit ?? 5;

  const hasGps =
    w.startLat != null && w.startLng != null && !Number.isNaN(w.startLat) &&
    !Number.isNaN(w.startLng);
  const workoutName = normalizeName(w.sourceName ?? "");

  const scored: TrailMatchCandidate[] = [];
  for (const preset of library) {
    if (preset.startLat == null || preset.startLng == null) continue;

    const distanceKm = hasGps
      ? haversineKm(
          w.startLat!,
          w.startLng!,
          preset.startLat,
          preset.startLng,
        )
      : Number.POSITIVE_INFINITY;

    // Skip presets outside a generous outer bound unless name match is
    // strong (people sometimes have GPS glitches at trailheads).
    const nameScore = workoutName
      ? nameOverlapScore(workoutName, normalizeName(preset.name))
      : 0;
    if (distanceKm > FAR_KM && nameScore < 0.7) continue;

    const profileScore = profileMatchScore(w, preset);

    // Combined score: proximity carries the most weight when GPS is
    // available; name+profile fill in for edge cases.
    const proxScore = hasGps
      ? Math.max(0, 1 - distanceKm / FAR_KM)
      : 0.4; // no GPS → don't punish, but don't rank as high as with-GPS matches
    const totalScore =
      proxScore * 0.55 + nameScore * 0.3 + profileScore * 0.15;

    scored.push({ preset, distanceKm, nameScore, profileScore, totalScore });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);
  // Cap at limit but also drop noise below a reasonable threshold.
  return scored.filter((c) => c.totalScore > 0.25).slice(0, limit);
}

/**
 * Great-circle distance in km between two lat/lng points.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Normalized whitespace + lowercase, punctuation stripped. "Angel's
 * Landing" → "angels landing", "Mount Rainier — DC" → "mount rainier dc".
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Token overlap score with substring credit. Not a rigorous edit
 * distance — good enough because activity titles from Garmin tend to
 * either exactly match the trail ("Angels Landing") or embed the name
 * ("Zion — Angel's Landing hike").
 */
function nameOverlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aTokens = new Set(a.split(" ").filter((t) => t.length >= 3));
  const bTokens = new Set(b.split(" ").filter((t) => t.length >= 3));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap += 1;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

/**
 * Score how close the workout's distance + elevation are to the
 * preset's guidebook values. 1 = perfect, 0 = way off. Useful for
 * disambiguating multiple trailheads that share GPS (e.g., Longs Peak
 * TH serves both Chasm Lake and Longs Keyhole).
 */
function profileMatchScore(
  w: Pick<Workout, "distanceMeters" | "elevationGainMeters">,
  preset: TrailPreset,
): number {
  const distScore = w.distanceMeters
    ? proximityRatio(w.distanceMeters / 1000, preset.distanceKm)
    : 0.5;
  const elevScore = w.elevationGainMeters
    ? proximityRatio(
        w.elevationGainMeters * 3.28084,
        preset.elevationGainFt,
      )
    : 0.5;
  return (distScore + elevScore) / 2;
}

function proximityRatio(observed: number, expected: number): number {
  if (expected <= 0) return 0.5;
  const ratio = observed / expected;
  // Full credit if within ±25%, degrades linearly to 0 by ±100%.
  if (ratio >= 0.75 && ratio <= 1.25) return 1;
  if (ratio > 1.25) return Math.max(0, 1 - (ratio - 1.25) * 1.33);
  return Math.max(0, ratio / 0.75);
}
