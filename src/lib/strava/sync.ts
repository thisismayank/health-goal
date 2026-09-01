import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  stravaAccount,
  workout,
  workoutSource,
} from "@/db/schema";
import { ymd } from "@/lib/date";
import {
  getActivePlan,
  getCurrentUser,
  getWorkoutsOnLocalDate,
} from "@/lib/data";
import { categoriesCompatible, sessionCompletionQualifies } from "@/lib/plan";
import type { SessionCategory } from "@/db/schema";
import type { StravaActivity } from "./client";
import { getActivity, listActivitiesSince } from "./client";
import { mapStravaType } from "./mapping";
import { getValidTokens } from "./tokens";

export type SyncResult = {
  activityId: number;
  workoutId: number;
  plannedSessionId: number | null;
  action: "created" | "updated";
};

export async function syncActivity(
  userId: number,
  activityId: number,
): Promise<SyncResult> {
  const tokens = await getValidTokens(userId);
  if (!tokens) throw new Error("No Strava account for user");
  const activity = await getActivity(tokens.accessToken, activityId);
  const result = await upsertActivity(userId, activity);

  // Best-effort passport auto-link. syncStravaActivities (batch path)
  // already runs auto-link after import; the single-activity path
  // (Strava webhook, one hike at a time) was missing it, so real
  // webhook-delivered hikes weren't landing in the passport until the
  // user manually hit "Sync now." Naches Loop was the offender that
  // surfaced this.
  try {
    const { autoLinkPassport } = await import("@/lib/passport/auto-link");
    await autoLinkPassport(userId);
  } catch (e) {
    console.warn("[strava/syncActivity] passport auto-link failed:", e);
  }
  return result;
}

export async function upsertActivity(
  userId: number,
  a: StravaActivity,
): Promise<SyncResult> {
  const category = mapStravaType(
    a.sport_type,
    a.type,
    a.average_speed ?? null,
    a.total_elevation_gain ?? null,
  );
  const startTime = new Date(a.start_date);
  const localStart = new Date(a.start_date_local);
  const dateStr = ymd(localStart);

  const plan = await getActivePlan(userId);
  let plannedSessionId: number | null = null;
  let plannedIsOpen = false;
  let plannedQualifies = false;
  if (plan) {
    const rows = await db
      .select()
      .from(plannedSession)
      .where(
        and(
          eq(plannedSession.planId, plan.id),
          eq(plannedSession.date, dateStr),
        ),
      )
      .limit(1);
    const ps = rows[0];
    if (ps && sessionCompletionQualifies(a.elapsed_time, category, ps)) {
      plannedSessionId = ps.id;
      plannedIsOpen = ps.status === "planned";
      plannedQualifies = true;
    }
  }

  const existing = await db
    .select()
    .from(workoutSource)
    .where(
      and(
        eq(workoutSource.provider, "strava"),
        eq(workoutSource.providerActivityId, String(a.id)),
      ),
    )
    .limit(1);

  // Strava's total_elevation_gain is barometric-summed and often
  // wildly wrong for tree-covered / building-shaded activities. Devin
  // round 2 caught 14,000 ft over 11 miles that slipped my 300 m/km
  // filter (234 m/km — still an implausible 23% sustained grade).
  //
  // Rule: drop anything above 150 m/km (15% average — even the
  // Wonderland Trail averages under 100). Also drop when the raw
  // gain is >2000 m and the activity name looks like a routine walk
  // (Strava mislabels tall-building elevator rides as gain).
  const rawGainM = a.total_elevation_gain ?? null;
  const gainPerKm =
    rawGainM != null && a.distance && a.distance > 0
      ? (rawGainM * 1000) / a.distance
      : 0;
  const routineName = /walk|commute|errand/i.test(a.name ?? "");
  const impossibleTotal = rawGainM != null && rawGainM > 2000 && routineName;
  const sanitizedGainM = gainPerKm > 150 || impossibleTotal ? null : rawGainM;

  const workoutValues = {
    userId,
    plannedSessionId,
    startTime,
    endTime: new Date(startTime.getTime() + a.elapsed_time * 1000),
    type: category,
    durationSeconds: a.elapsed_time,
    distanceMeters: a.distance ?? null,
    elevationGainMeters: sanitizedGainM,
    averageHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    notes: a.description?.trim() || null,
    sourceName: a.name?.trim() || null,
    startLat:
      Array.isArray(a.start_latlng) && a.start_latlng.length === 2
        ? a.start_latlng[0]
        : null,
    startLng:
      Array.isArray(a.start_latlng) && a.start_latlng.length === 2
        ? a.start_latlng[1]
        : null,
    canonicalSource: "strava",
  };

  let workoutId: number;
  let action: SyncResult["action"];
  let previousPlannedSessionId: number | null = null;

  if (existing[0]) {
    workoutId = existing[0].workoutId;
    const [prior] = await db
      .select({ plannedSessionId: workout.plannedSessionId })
      .from(workout)
      .where(eq(workout.id, workoutId));
    previousPlannedSessionId = prior?.plannedSessionId ?? null;
    await db.update(workout).set(workoutValues).where(eq(workout.id, workoutId));
    await db
      .update(workoutSource)
      .set({ syncedAt: new Date(), metadataJson: JSON.stringify(a) })
      .where(eq(workoutSource.id, existing[0].id));
    action = "updated";
  } else {
    // Cross-provider dedupe: same activity via intervals or elsewhere
    // shouldn't produce a second workout row.
    const { findExistingDuplicate } = await import("@/lib/workouts/dedupe");
    const dupe = await findExistingDuplicate({
      userId,
      startTime,
      distanceMeters: workoutValues.distanceMeters,
    });
    if (dupe) {
      workoutId = dupe.id;
      // Prefer Strava as the canonical source when it arrives (richer
      // GPS + name than intervals mirror).
      await db
        .update(workout)
        .set({ ...workoutValues, canonicalSource: "strava" })
        .where(eq(workout.id, workoutId));
      await db.insert(workoutSource).values({
        workoutId,
        provider: "strava",
        providerActivityId: String(a.id),
        metadataJson: JSON.stringify(a),
      });
      action = "updated"; // record for the sync summary
    } else {
      const [inserted] = await db
        .insert(workout)
        .values(workoutValues)
        .returning({ id: workout.id });
      workoutId = inserted.id;
      await db.insert(workoutSource).values({
        workoutId,
        provider: "strava",
        providerActivityId: String(a.id),
        metadataJson: JSON.stringify(a),
      });
      action = "created";
    }
  }

  // Auto-mark the planned session complete whenever the AGGREGATE of
  // same-day compatible workouts qualifies. Distributed active-recovery
  // walks, split cardio sessions, and multi-part strength blocks all sum
  // toward the target. Idempotent — safe to fire on create AND update.
  if (plannedSessionId && plannedIsOpen) {
    const user = await getCurrentUser();
    const tz = user?.timezone ?? "UTC";
    const sameDayRows = await getWorkoutsOnLocalDate(userId, dateStr, tz);
    const [ps] = await db
      .select()
      .from(plannedSession)
      .where(eq(plannedSession.id, plannedSessionId))
      .limit(1);
    if (ps) {
      const compatibleSeconds = sameDayRows
        .filter((w) =>
          categoriesCompatible(w.type as SessionCategory, ps.sessionCategory),
        )
        .reduce((sum, w) => sum + (w.durationSeconds ?? 0), 0);
      if (
        sessionCompletionQualifies(
          compatibleSeconds,
          ps.sessionCategory,
          ps,
        )
      ) {
        await db
          .update(plannedSession)
          .set({ status: "completed" })
          .where(eq(plannedSession.id, plannedSessionId));
      }
    }
  }

  // Retroactive un-completion: if we just unlinked from a previously-linked
  // session, and no other workouts remain on it, revert that session to
  // "planned" so it can be attempted for real.
  if (
    previousPlannedSessionId &&
    previousPlannedSessionId !== plannedSessionId
  ) {
    const remaining = await db
      .select({ id: workout.id })
      .from(workout)
      .where(eq(workout.plannedSessionId, previousPlannedSessionId))
      .limit(1);
    if (remaining.length === 0) {
      await db
        .update(plannedSession)
        .set({ status: "planned" })
        .where(
          and(
            eq(plannedSession.id, previousPlannedSessionId),
            eq(plannedSession.status, "completed"),
          ),
        );
    }
  }

  return { activityId: a.id, workoutId, plannedSessionId, action };
}

export async function syncRecent(
  userId: number,
  sinceDaysAgo = 30,
): Promise<SyncResult[]> {
  const tokens = await getValidTokens(userId);
  if (!tokens) throw new Error("No Strava account for user");
  const after = Math.floor(Date.now() / 1000) - sinceDaysAgo * 86400;
  // For anything > 60d use the paginated variant so we don't cap at
  // the first 50 activities. Short windows keep the fast path.
  const activities =
    sinceDaysAgo > 60
      ? await (
          await import("./client")
        ).listAllActivitiesSince(tokens.accessToken, after)
      : await listActivitiesSince(tokens.accessToken, after);

  const results: SyncResult[] = [];
  for (const a of activities) {
    try {
      results.push(await upsertActivity(userId, a));
    } catch (e) {
      console.error(`sync activity ${a.id} failed:`, e);
    }
  }

  await db
    .update(stravaAccount)
    .set({ lastSyncAt: new Date() })
    .where(eq(stravaAccount.userId, userId));

  // Best-effort passport auto-link. If any of the just-imported
  // activities strongly match a preset (proximity + name), the
  // trailCompletion row is created here so users don't have to
  // click through /trails/backfill after every sync. Never throws
  // — a matcher failure shouldn't tank the sync.
  try {
    const { autoLinkPassport } = await import("@/lib/passport/auto-link");
    await autoLinkPassport(userId);
  } catch (e) {
    console.warn("[strava/sync] passport auto-link failed:", e);
  }
  return results;
}

export async function deleteActivity(userId: number, activityId: number) {
  const src = await db
    .select()
    .from(workoutSource)
    .where(
      and(
        eq(workoutSource.provider, "strava"),
        eq(workoutSource.providerActivityId, String(activityId)),
      ),
    )
    .limit(1);
  if (!src[0]) return;
  // Cascade drops workout_source via workout FK
  await db.delete(workout).where(eq(workout.id, src[0].workoutId));
}
