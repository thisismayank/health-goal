/**
 * One-shot backfill: populate workout.sourceName for legacy Strava rows
 * that were synced before the sourceName column existed. Reads
 * workoutSource.metadataJson (full Strava activity payload) and extracts
 * `name`.
 *
 * Idempotent — runs each visit but only touches rows where sourceName is
 * still NULL, so it converges to no-op after the first call.
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { workout, workoutSource } from "@/db/schema";

export async function backfillSourceNamesFromStrava(
  userId: number,
): Promise<number> {
  const rows = await db
    .select({
      workoutId: workout.id,
      metadataJson: workoutSource.metadataJson,
    })
    .from(workout)
    .innerJoin(workoutSource, eq(workoutSource.workoutId, workout.id))
    .where(
      and(
        eq(workout.userId, userId),
        isNull(workout.sourceName),
        eq(workoutSource.provider, "strava"),
      ),
    );

  let updated = 0;
  for (const r of rows) {
    if (!r.metadataJson) continue;
    try {
      const meta = JSON.parse(r.metadataJson) as { name?: unknown };
      const name = typeof meta.name === "string" ? meta.name.trim() : "";
      if (name) {
        await db
          .update(workout)
          .set({ sourceName: name })
          .where(eq(workout.id, r.workoutId));
        updated++;
      }
    } catch {
      // skip malformed rows
    }
  }
  return updated;
}
