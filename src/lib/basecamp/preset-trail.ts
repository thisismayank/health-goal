/**
 * Adapter: TrailPreset → virtual Trail row.
 *
 * The readiness engine (assessTrail) reads a Trail (DB row). Preset
 * detail pages want to run the assessment WITHOUT persisting — user
 * hasn't saved the trail yet. This builds an ephemeral Trail-shaped
 * object with a sentinel id so assessTrail can run against it.
 */

import type { Trail } from "@/db/schema";
import type { TrailPreset } from "./trail-library";

export function presetToVirtualTrail(
  preset: TrailPreset,
  userId: number,
): Trail {
  const now = new Date();
  return {
    id: -1,
    userId,
    name: preset.name,
    url: null,
    distanceKm: preset.distanceKm,
    elevationGainFt: preset.elevationGainFt,
    maxAltitudeFt: preset.maxAltitudeFt,
    typicalHours: preset.typicalHours,
    packWeightLb: preset.packWeightLb,
    terrainGrade: preset.terrainGrade,
    targetDate: null,
    notes: preset.notes,
    presetSlug: preset.slug,
    isPrimary: false,
    createdAt: now,
  };
}
