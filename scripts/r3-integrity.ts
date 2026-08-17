/**
 * Round-3 integrity cleanup for Mayank:
 *  1) Merge cross-provider duplicate workouts (same user, start_time
 *     within 10 min, distance ±10%). Keep the earliest-created row
 *     as canonical, repoint workoutSource + trailCompletion +
 *     plannedSessionId, delete the dupes.
 *  2) Null out elevation on rows where gain/km > 300m (March
 *     corruption survivors — Devin found 14000ft on a 3-mile hike).
 *  3) Report what changed.
 */

import { and, asc, eq, ne, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  trailCompletion,
  userProfile,
  workout,
  workoutSource,
} from "../src/db/schema";

const WINDOW_MIN = 10;
const DIST_TOL = 0.1;

async function main() {
  const [user] = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(eq(userProfile.email, "mayank.uiet7@gmail.com"))
    .limit(1);
  if (!user) throw new Error("no user");

  // ---- Pass 1: dedupe workouts ----
  const rows = await db
    .select({
      id: workout.id,
      startTime: workout.startTime,
      distanceMeters: workout.distanceMeters,
      elevationGainMeters: workout.elevationGainMeters,
      canonicalSource: workout.canonicalSource,
      plannedSessionId: workout.plannedSessionId,
      type: workout.type,
      averageHr: workout.averageHr,
    })
    .from(workout)
    .where(eq(workout.userId, user.id))
    .orderBy(asc(workout.startTime), asc(workout.id));

  console.log(`\n[dedupe] scanning ${rows.length} workouts`);
  const merged: number[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (seen.has(rows[i].id)) continue;
    const a = rows[i];
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (seen.has(b.id)) continue;
      const diffMs = Math.abs(b.startTime.getTime() - a.startTime.getTime());
      if (diffMs > WINDOW_MIN * 60_000) break; // sorted; can bail
      if (a.distanceMeters != null && b.distanceMeters != null) {
        const ratio = b.distanceMeters / Math.max(1, a.distanceMeters);
        if (ratio < 1 - DIST_TOL || ratio > 1 + DIST_TOL) continue;
      }

      // Merge b → a. Preserve any richer data from b that a lacks.
      const patch: Record<string, unknown> = {};
      if (a.elevationGainMeters == null && b.elevationGainMeters != null)
        patch.elevationGainMeters = b.elevationGainMeters;
      if (a.averageHr == null && b.averageHr != null)
        patch.averageHr = b.averageHr;
      if (a.plannedSessionId == null && b.plannedSessionId != null)
        patch.plannedSessionId = b.plannedSessionId;
      // Prefer 'strava' as canonical when either side has it.
      if (b.canonicalSource === "strava" && a.canonicalSource !== "strava")
        patch.canonicalSource = "strava";
      if (Object.keys(patch).length > 0) {
        await db.update(workout).set(patch).where(eq(workout.id, a.id));
      }
      // Move provider metadata + completion links from b to a.
      await db
        .update(workoutSource)
        .set({ workoutId: a.id })
        .where(eq(workoutSource.workoutId, b.id));
      await db
        .update(trailCompletion)
        .set({ workoutId: a.id })
        .where(eq(trailCompletion.workoutId, b.id));
      // Delete the dupe.
      await db.delete(workout).where(eq(workout.id, b.id));
      seen.add(b.id);
      merged.push(b.id);
      console.log(
        `  merged ${b.id} → ${a.id} (${b.startTime.toISOString().slice(0, 16)} · ${a.type})`,
      );
    }
  }
  console.log(`[dedupe] merged ${merged.length} duplicates`);

  // ---- Pass 2: sanitize corrupted elevation ----
  // Tightened threshold (150 m/km — 15% avg grade). Also drop 2000+ m
  // gain when the activity is named 'walk'/'commute' — those are
  // Strava mistaking elevator/building floors for elevation.
  const bad = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM workout
        WHERE user_id = ${user.id}
          AND elevation_gain_meters IS NOT NULL
          AND distance_meters IS NOT NULL
          AND distance_meters > 0
          AND (
            (elevation_gain_meters * 1000.0 / distance_meters) > 150
            OR (elevation_gain_meters > 2000 AND source_name ~* '(walk|commute|errand)')
          )`,
  );
  console.log(`\n[elevation] rows to null:`, bad);
  await db.execute(
    sql`UPDATE workout
        SET elevation_gain_meters = NULL
        WHERE user_id = ${user.id}
          AND elevation_gain_meters IS NOT NULL
          AND distance_meters IS NOT NULL
          AND distance_meters > 0
          AND (
            (elevation_gain_meters * 1000.0 / distance_meters) > 150
            OR (elevation_gain_meters > 2000 AND source_name ~* '(walk|commute|errand)')
          )`,
  );
  console.log("[elevation] done");

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
