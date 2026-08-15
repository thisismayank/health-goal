import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  stravaAccount,
  workout,
  workoutSource,
} from "@/db/schema";
import { ymd } from "@/lib/date";
import { getActivePlan } from "@/lib/data";
import { categoriesCompatible } from "@/lib/plan";
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
  return upsertActivity(userId, activity);
}

export async function upsertActivity(
  userId: number,
  a: StravaActivity,
): Promise<SyncResult> {
  const category = mapStravaType(a.sport_type, a.type);
  const startTime = new Date(a.start_date);
  const localStart = new Date(a.start_date_local);
  const dateStr = ymd(localStart);

  const plan = await getActivePlan(userId);
  let plannedSessionId: number | null = null;
  let plannedIsOpen = false;
  let plannedCompatible = false;
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
    if (ps && categoriesCompatible(category, ps.sessionCategory)) {
      plannedSessionId = ps.id;
      plannedIsOpen = ps.status === "planned";
      plannedCompatible = true;
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

  const workoutValues = {
    userId,
    plannedSessionId,
    startTime,
    endTime: new Date(startTime.getTime() + a.elapsed_time * 1000),
    type: category,
    durationSeconds: a.elapsed_time,
    distanceMeters: a.distance ?? null,
    elevationGainMeters: a.total_elevation_gain ?? null,
    averageHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    notes: a.description?.trim() || null,
    canonicalSource: "strava",
  };

  let workoutId: number;
  let action: SyncResult["action"];

  if (existing[0]) {
    workoutId = existing[0].workoutId;
    await db.update(workout).set(workoutValues).where(eq(workout.id, workoutId));
    await db
      .update(workoutSource)
      .set({ syncedAt: new Date(), metadataJson: JSON.stringify(a) })
      .where(eq(workoutSource.id, existing[0].id));
    action = "updated";
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

  // Auto-mark the planned session complete only on the FIRST create for a
  // compatible activity of the day. Same-day activities of a different kind
  // (e.g. a run on a lifting day) come in as unlinked extras.
  if (plannedSessionId && plannedIsOpen && plannedCompatible && action === "created") {
    await db
      .update(plannedSession)
      .set({ status: "completed" })
      .where(eq(plannedSession.id, plannedSessionId));
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
  const activities = await listActivitiesSince(tokens.accessToken, after);

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
