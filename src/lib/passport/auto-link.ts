/**
 * Passport auto-populator.
 *
 * Devin r3: "Passport still empty and manual. 0 unique · 0 total with
 * 'Log completions from any saved trail' — Backfill matches still don't
 * populate it, so the one mechanic that works with zero training data
 * starts cold."
 *
 * The gap: users had to open /trails/backfill and click "This one" on
 * each suggestion to link a workout to a preset (which is what creates
 * the trailCompletion row the passport counts). Nothing did it
 * automatically even for near-certain matches.
 *
 * This helper scans a user's hike-like workouts that aren't already
 * linked and creates trailCompletion rows for any match whose
 * totalScore clears STRONG_MATCH — the same threshold the backfill UI
 * treats as "strong match" in its label. Weaker matches stay manual.
 *
 * Non-destructive: never overwrites an existing link, never touches
 * workouts that already have a trailCompletion row, and idempotent
 * across re-runs.
 */

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, trailCompletion, workout } from "@/db/schema";
import { matchWorkoutToTrails } from "@/lib/basecamp/trail-matcher";
import { findTrailBySlug } from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";

const HIKE_TYPES = ["OUTDOOR_HIKE", "LOADED_HIKE", "LONG_MOUNTAIN_SESSION"];
const STRONG_MATCH = 0.7;

export type AutoLinkResult = {
  scanned: number;
  linked: number;
  skipped: number; // no match, or below threshold, or already linked
};

export async function autoLinkPassport(userId: number): Promise<AutoLinkResult> {
  const workouts = await db
    .select({
      id: workout.id,
      startTime: workout.startTime,
      durationSeconds: workout.durationSeconds,
      distanceMeters: workout.distanceMeters,
      elevationGainMeters: workout.elevationGainMeters,
      sourceName: workout.sourceName,
      startLat: workout.startLat,
      startLng: workout.startLng,
    })
    .from(workout)
    .leftJoin(trailCompletion, eq(trailCompletion.workoutId, workout.id))
    .where(
      and(
        eq(workout.userId, userId),
        inArray(workout.type, HIKE_TYPES),
        isNull(trailCompletion.id),
      ),
    )
    .orderBy(desc(workout.startTime));

  const out: AutoLinkResult = {
    scanned: workouts.length,
    linked: 0,
    skipped: 0,
  };
  if (workouts.length === 0) return out;

  // Cache preset lookups + user's saved trails so we don't re-query
  // per candidate.
  const userTrails = await db
    .select({ id: trail.id, presetSlug: trail.presetSlug })
    .from(trail)
    .where(eq(trail.userId, userId));
  const trailIdByPresetSlug = new Map<string, number>();
  for (const t of userTrails) {
    if (t.presetSlug) trailIdByPresetSlug.set(t.presetSlug, t.id);
  }

  for (const w of workouts) {
    const matches = matchWorkoutToTrails(w, { limit: 1 });
    const top = matches[0];
    if (!top || top.totalScore < STRONG_MATCH) {
      out.skipped += 1;
      continue;
    }

    // Ensure the preset resolves — some slugs live only in
    // EXTRA_TRAIL_PRESETS (see trail-coords.ts).
    const preset =
      findTrailBySlug(top.preset.slug) ??
      getFullTrailLibrary().find((p) => p.slug === top.preset.slug);
    if (!preset) {
      out.skipped += 1;
      continue;
    }

    // Reuse or create the user's saved trail row for this preset.
    // Trail schema doesn't have region/country columns — those live
    // in the preset library. Fold region into notes for context.
    let trailId = trailIdByPresetSlug.get(preset.slug);
    if (trailId == null) {
      const [saved] = await db
        .insert(trail)
        .values({
          userId,
          name: preset.name,
          distanceKm: preset.distanceKm,
          elevationGainFt: preset.elevationGainFt,
          maxAltitudeFt: preset.maxAltitudeFt,
          typicalHours: preset.typicalHours,
          packWeightLb: preset.packWeightLb,
          terrainGrade: preset.terrainGrade,
          notes: preset.notes
            ? `${preset.region} — ${preset.notes}`
            : preset.region,
          presetSlug: preset.slug,
        })
        .returning({ id: trail.id });
      trailId = saved.id;
      trailIdByPresetSlug.set(preset.slug, trailId);
    }

    // completedAt derived from the workout's local date. We don't have
    // the user's timezone in scope here (auto-link runs from server
    // paths where re-querying userProfile per row is wasteful), so
    // use UTC — off by ≤1 day for edge cases, acceptable for the
    // passport which shows dates, not timestamps.
    const completedAt = w.startTime.toISOString().slice(0, 10);
    const durationMin =
      w.durationSeconds != null && w.durationSeconds > 0
        ? Math.round(w.durationSeconds / 60)
        : null;

    await db.insert(trailCompletion).values({
      userId,
      trailId,
      completedAt,
      workoutId: w.id,
      timeMinutes: durationMin,
    });
    out.linked += 1;
  }

  return out;
}
