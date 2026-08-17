/**
 * Cross-provider workout dedupe. The same underlying activity often
 * arrives through more than one channel — Strava (direct OAuth) and
 * intervals.icu (which mirrors Garmin, which may also push to Strava).
 * Without a cross-provider check, we get two workout rows for the same
 * hike: one from each sync pipeline.
 *
 * Strategy: before inserting a new workout, look for an existing row
 * from the same user whose start_time is within a 10-minute window
 * and (if distance is known on both sides) whose distance is within
 * ±10%. If found, treat the new import as a duplicate — return the
 * existing id so the caller can attach its own provider metadata to
 * workoutSource without minting a second workout.
 *
 * The window is deliberately generous: providers occasionally disagree
 * on start_time by a few minutes (barometer boot delay, activity save
 * quirks). Ten minutes catches these without merging genuinely
 * separate back-to-back activities.
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { workout } from "@/db/schema";

const WINDOW_MS = 10 * 60 * 1000;
const DIST_TOLERANCE = 0.1; // ±10%

export async function findExistingDuplicate(input: {
  userId: number;
  startTime: Date;
  distanceMeters: number | null;
}): Promise<{ id: number; canonicalSource: string } | null> {
  const lo = new Date(input.startTime.getTime() - WINDOW_MS);
  const hi = new Date(input.startTime.getTime() + WINDOW_MS);
  const candidates = await db
    .select({
      id: workout.id,
      startTime: workout.startTime,
      distanceMeters: workout.distanceMeters,
      canonicalSource: workout.canonicalSource,
    })
    .from(workout)
    .where(
      and(
        eq(workout.userId, input.userId),
        gte(workout.startTime, lo),
        lte(workout.startTime, hi),
      ),
    );
  for (const c of candidates) {
    if (input.distanceMeters != null && c.distanceMeters != null) {
      const ratio = c.distanceMeters / Math.max(1, input.distanceMeters);
      if (ratio < 1 - DIST_TOLERANCE || ratio > 1 + DIST_TOLERANCE) continue;
    }
    // Time window alone qualifies when either side lacks distance.
    return { id: c.id, canonicalSource: c.canonicalSource };
  }
  return null;
}
