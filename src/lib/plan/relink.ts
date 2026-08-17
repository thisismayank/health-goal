/**
 * Backfill helper: walk every workout the user has in the plan's
 * date range and (re)link it to the planned session on the same day
 * if it qualifies under the current compatibility + duration rules.
 *
 * Called after a plan is created / uploaded / regenerated so imported
 * activities that predate the plan can still count against it. Also
 * safe to call after CATEGORY_GROUPS is widened (fixes historical
 * orphans without a data migration).
 *
 * Never touches:
 *   - workouts already linked to a different session (respects user's
 *     manual link choices)
 *   - workouts outside the plan's date range
 */

import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  trainingPlan,
  workout,
  type SessionCategory,
} from "@/db/schema";
import { sessionCompletionQualifies } from "@/lib/plan";

export type RelinkResult = {
  planId: number;
  scanned: number;
  linked: number;
  alreadyLinked: number;
  noPlannedOnDate: number;
  incompatible: number;
};

export async function relinkOrphanWorkouts(
  userId: number,
  planId?: number,
): Promise<RelinkResult> {
  // Default to the user's active plan.
  const [plan] = await db
    .select()
    .from(trainingPlan)
    .where(
      planId != null
        ? and(eq(trainingPlan.userId, userId), eq(trainingPlan.id, planId))
        : and(
            eq(trainingPlan.userId, userId),
            eq(trainingPlan.status, "active"),
          ),
    )
    .limit(1);
  if (!plan) {
    return {
      planId: -1,
      scanned: 0,
      linked: 0,
      alreadyLinked: 0,
      noPlannedOnDate: 0,
      incompatible: 0,
    };
  }

  const startTime = new Date(plan.startDate + "T00:00:00Z");
  const endTime = plan.eventDate
    ? new Date(plan.eventDate + "T23:59:59Z")
    : new Date();

  const workoutsInRange = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        gte(workout.startTime, startTime),
        lte(workout.startTime, endTime),
      ),
    );

  const sessions = await db
    .select()
    .from(plannedSession)
    .where(eq(plannedSession.planId, plan.id));
  const byDate = new Map<string, (typeof sessions)[number]>();
  for (const s of sessions) byDate.set(s.date, s);

  const result: RelinkResult = {
    planId: plan.id,
    scanned: workoutsInRange.length,
    linked: 0,
    alreadyLinked: 0,
    noPlannedOnDate: 0,
    incompatible: 0,
  };

  for (const w of workoutsInRange) {
    if (w.plannedSessionId != null) {
      result.alreadyLinked += 1;
      continue;
    }
    const ymd = w.startTime.toISOString().slice(0, 10);
    const ps = byDate.get(ymd);
    if (!ps) {
      result.noPlannedOnDate += 1;
      continue;
    }
    const qualifies = sessionCompletionQualifies(
      w.durationSeconds,
      w.type as SessionCategory,
      {
        targetDurationMinutes: ps.targetDurationMinutes,
        sessionCategory: ps.sessionCategory,
      },
    );
    if (!qualifies) {
      result.incompatible += 1;
      continue;
    }
    await db
      .update(workout)
      .set({ plannedSessionId: ps.id })
      .where(eq(workout.id, w.id));
    result.linked += 1;
  }

  return result;
}
