"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  stravaAccount,
  strengthExercise,
  workout,
} from "@/db/schema";
import { getCurrentUser } from "./data";
import {
  getCumulativeVerticalFt,
  RAINIER_SUMMIT_FT,
  WAYPOINTS,
  type Waypoint,
} from "./basecamp/summit";

export type LoggedStrengthSet = {
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
};

export type LoggedExercise = {
  name: string;
  sets: LoggedStrengthSet[];
};

export type CompleteSessionInput = {
  plannedSessionId: number;
  actualDurationMinutes: number;
  rpe: number;
  notes?: string;
  exercises?: LoggedExercise[];
};

export type CompletionSummary = {
  sessionTitle: string;
  categoryDisplay: string;
  actualDurationMinutes: number;
  rpe: number;
  verticalGainedFt: number;
  newTotalFt: number;
  waypointCleared: Waypoint | null;
  summitCount: number;
};

export async function completeSession(input: CompleteSessionInput): Promise<{
  workoutId: number;
  summary: CompletionSummary;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const [ps] = await db
    .select()
    .from(plannedSession)
    .where(eq(plannedSession.id, input.plannedSessionId))
    .limit(1);
  if (!ps) throw new Error("Planned session not found");

  const preTotalFt = await getCumulativeVerticalFt(user.id);

  const endTime = new Date();
  const startTime = new Date(
    endTime.getTime() - input.actualDurationMinutes * 60_000,
  );

  const [w] = await db
    .insert(workout)
    .values({
      userId: user.id,
      plannedSessionId: ps.id,
      startTime,
      endTime,
      type: ps.sessionCategory,
      durationSeconds: input.actualDurationMinutes * 60,
      rpe: input.rpe,
      notes: input.notes ?? null,
      canonicalSource: "manual",
    })
    .returning();

  if (input.exercises && input.exercises.length > 0) {
    const rows = input.exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.reps != null || s.weightKg != null)
        .map((s, i) => ({
          workoutId: w.id,
          exerciseName: ex.name,
          setNumber: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rir: s.rir,
        })),
    );
    if (rows.length > 0) {
      await db.insert(strengthExercise).values(rows);
    }
  }

  await db
    .update(plannedSession)
    .set({ status: "completed" })
    .where(eq(plannedSession.id, ps.id));

  const postTotalFt = await getCumulativeVerticalFt(user.id);
  const verticalGainedFt = Math.max(0, postTotalFt - preTotalFt);

  // Waypoint cleared? Compare pre/post within the CURRENT mountain (mod summit).
  // A single workout can push you past multiple waypoints; report the highest.
  const perMountain = RAINIER_SUMMIT_FT;
  const preRemainder = preTotalFt % perMountain;
  const postRemainder = postTotalFt % perMountain;
  // Handle the case where we crossed a full summit (preRemainder is high,
  // postRemainder wraps back). Then anything the postRemainder is above counts.
  const crossedSummit = Math.floor(postTotalFt / perMountain) > Math.floor(preTotalFt / perMountain);
  const waypointCleared = WAYPOINTS.reduce<Waypoint | null>((best, w) => {
    const justCrossed = crossedSummit
      ? postRemainder >= w.ft
      : preRemainder < w.ft && postRemainder >= w.ft;
    if (justCrossed && (!best || w.ft > best.ft)) return w;
    return best;
  }, null);

  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/character");

  return {
    workoutId: w.id,
    summary: {
      sessionTitle: ps.title,
      categoryDisplay: ps.sessionCategory.replaceAll("_", " ").toLowerCase(),
      actualDurationMinutes: input.actualDurationMinutes,
      rpe: input.rpe,
      verticalGainedFt,
      newTotalFt: postTotalFt,
      waypointCleared,
      summitCount: Math.floor(postTotalFt / perMountain),
    },
  };
}

export async function skipSession(plannedSessionId: number) {
  await db
    .update(plannedSession)
    .set({ status: "skipped" })
    .where(eq(plannedSession.id, plannedSessionId));
  revalidatePath("/");
  revalidatePath("/week");
}

export async function reopenSession(plannedSessionId: number) {
  await db
    .update(plannedSession)
    .set({ status: "planned" })
    .where(eq(plannedSession.id, plannedSessionId));
  // Unlink any workouts (preserves imported/manual data as extras on that day)
  // rather than deleting them.
  await db
    .update(workout)
    .set({ plannedSessionId: null })
    .where(eq(workout.plannedSessionId, plannedSessionId));
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/history");
}

export async function logBodyMetric(input: {
  date: string;
  weightKg?: number | null;
  fatigue?: number | null;
  notes?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const existing = await db
    .select()
    .from(dailyMetric)
    .where(and(eq(dailyMetric.userId, user.id), eq(dailyMetric.date, input.date)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(dailyMetric)
      .set({
        bodyWeightKg: input.weightKg ?? existing[0].bodyWeightKg,
        fatigue1to10: input.fatigue ?? existing[0].fatigue1to10,
        notes: input.notes ?? existing[0].notes,
      })
      .where(eq(dailyMetric.id, existing[0].id));
  } else {
    await db.insert(dailyMetric).values({
      userId: user.id,
      date: input.date,
      bodyWeightKg: input.weightKg ?? null,
      fatigue1to10: input.fatigue ?? null,
      notes: input.notes ?? null,
    });
  }

  revalidatePath("/body");
  revalidatePath("/");
}

export async function syncStravaNow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { syncRecent } = await import("./strava/sync");
  const results = await syncRecent(user.id, 30);
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/history");
  revalidatePath("/settings");
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  return { total: results.length, created, updated };
}

export async function syncIntervalsNow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { syncRecent } = await import("./intervals/sync");
  const result = await syncRecent(user.id, 30);
  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/settings");
  return result;
}

export async function disconnectStrava() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const rows = await db
    .select()
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, user.id))
    .limit(1);
  const account = rows[0];
  if (account) {
    try {
      const { deauthorize } = await import("./strava/client");
      await deauthorize(account.accessToken);
    } catch (e) {
      console.warn("strava deauth failed (deleting local record anyway):", e);
    }
    await db.delete(stravaAccount).where(eq(stravaAccount.id, account.id));
  }
  revalidatePath("/settings");
}
