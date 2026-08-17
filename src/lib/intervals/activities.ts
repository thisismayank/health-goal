/**
 * Backfill the workout table from intervals.icu activities. Intervals
 * bridges Garmin/Wahoo/Zwift/Strava, so this pulls the user's full
 * training history regardless of device — sleep/wellness lives in
 * ./sync.ts, activities live here.
 *
 * We de-dupe via workoutSource (provider='intervals', providerActivityId)
 * so re-running the backfill is safe.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workout, workoutSource } from "@/db/schema";
import { getActivitiesRange, type IntervalsActivity } from "./client";
import { getCredsForSync, markSynced } from "./credentials";

export type ActivitiesSyncResult = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
};

// Coarse mapping intervals type → our canonical workout type. Keep it
// narrow — this is only used for filtering / display, not for training
// analytics.
function mapType(t: string | null | undefined): string {
  if (!t) return "OTHER";
  const s = t.toLowerCase();
  if (s.includes("hike")) return "OUTDOOR_HIKE";
  if (s.includes("run")) return "EASY_RUN";
  if (s.includes("ride") || s.includes("bike") || s.includes("cycl"))
    return "ZONE2_CARDIO";
  if (s.includes("walk")) return "OUTDOOR_HIKE";
  if (s.includes("swim")) return "ZONE2_CARDIO";
  if (s.includes("strength") || s.includes("weight")) return "FULL_BODY_STRENGTH";
  return "OTHER";
}

function nz(v: number | null | undefined): number | null {
  return v != null && !Number.isNaN(v) ? v : null;
}

export async function syncActivitiesRecent(
  userId: number,
  daysBack = 365,
): Promise<ActivitiesSyncResult> {
  const creds = await getCredsForSync(userId);
  if (!creds) {
    return { fetched: 0, created: 0, updated: 0, skipped: 0 };
  }

  const newest = new Date();
  const oldest = new Date(newest.getTime() - daysBack * 86400 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const activities = await getActivitiesRange(creds, ymd(oldest), ymd(newest));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const a of activities) {
    try {
      const r = await upsertOne(userId, a);
      if (r === "created") created += 1;
      else if (r === "updated") updated += 1;
      else skipped += 1;
    } catch (e) {
      console.error(`[intervals activity ${a.id}] upsert failed:`, e);
      skipped += 1;
    }
  }

  await markSynced(userId);
  return { fetched: activities.length, created, updated, skipped };
}

async function upsertOne(
  userId: number,
  a: IntervalsActivity,
): Promise<"created" | "updated" | "skipped"> {
  const startTime = new Date(a.start_date_local);
  if (Number.isNaN(startTime.getTime())) return "skipped";

  // Prefer moving_time; fall back to elapsed_time. Some indoor / manual
  // entries have neither — those we still store (with null duration).
  const durationSeconds = nz(a.moving_time) ?? nz(a.elapsed_time);
  const endTime = durationSeconds
    ? new Date(startTime.getTime() + durationSeconds * 1000)
    : null;

  const values = {
    userId,
    plannedSessionId: null,
    startTime,
    endTime,
    type: mapType(a.type),
    durationSeconds: durationSeconds,
    distanceMeters: nz(a.distance),
    elevationGainMeters: nz(a.total_elevation_gain),
    averageHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    sourceName: a.name?.trim() || null,
    startLat: nz(a.start_lat),
    startLng: nz(a.start_lng),
    canonicalSource: "intervals",
  };

  const [existing] = await db
    .select()
    .from(workoutSource)
    .where(
      and(
        eq(workoutSource.provider, "intervals"),
        eq(workoutSource.providerActivityId, String(a.id)),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(workout)
      .set(values)
      .where(eq(workout.id, existing.workoutId));
    return "updated";
  }

  // Cross-provider dedupe: if a Strava import (or any other provider)
  // already wrote this activity, attach our intervals metadata to
  // that row instead of creating a second workout. Otherwise volume
  // + vertical + compliance-window all double-count.
  const { findExistingDuplicate } = await import("@/lib/workouts/dedupe");
  const dupe = await findExistingDuplicate({
    userId,
    startTime,
    distanceMeters: values.distanceMeters,
  });
  if (dupe) {
    await db.insert(workoutSource).values({
      workoutId: dupe.id,
      provider: "intervals",
      providerActivityId: String(a.id),
    });
    return "skipped"; // recorded provider metadata, didn't add a workout row
  }

  const [inserted] = await db.insert(workout).values(values).returning();
  await db.insert(workoutSource).values({
    workoutId: inserted.id,
    provider: "intervals",
    providerActivityId: String(a.id),
  });
  return "created";
}
