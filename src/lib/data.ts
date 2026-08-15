import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  strengthExercise,
  trainingPlan,
  userProfile,
  workout,
  type PlannedSession,
  type StrengthExercise,
  type Workout,
} from "@/db/schema";
import { ymd, weekDays, weekStart } from "./date";

export async function getCurrentUser() {
  const users = await db.select().from(userProfile).limit(1);
  return users[0] ?? null;
}

export async function getActivePlan(userId: number) {
  const plans = await db
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.userId, userId), eq(trainingPlan.status, "active")))
    .limit(1);
  return plans[0] ?? null;
}

export async function getSessionForDate(planId: number, dateYmd: string) {
  const rows = await db
    .select()
    .from(plannedSession)
    .where(
      and(eq(plannedSession.planId, planId), eq(plannedSession.date, dateYmd)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getWeekSessions(
  planId: number,
  anchor: Date,
): Promise<PlannedSession[]> {
  const days = weekDays(anchor);
  const startYmd = ymd(days[0]);
  const endYmd = ymd(days[6]);
  return db
    .select()
    .from(plannedSession)
    .where(
      and(
        eq(plannedSession.planId, planId),
        gte(plannedSession.date, startYmd),
        lte(plannedSession.date, endYmd),
      ),
    )
    .orderBy(plannedSession.date);
}

export async function getWorkoutForPlannedSession(
  plannedSessionId: number,
): Promise<Workout | null> {
  const rows = await db
    .select()
    .from(workout)
    .where(eq(workout.plannedSessionId, plannedSessionId))
    .orderBy(desc(workout.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWeekWorkouts(userId: number, anchor: Date) {
  const days = weekDays(anchor);
  const startDate = days[0];
  const endDate = new Date(days[6]);
  endDate.setHours(23, 59, 59, 999);
  return db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        gte(workout.startTime, startDate),
        lte(workout.startTime, endDate),
      ),
    );
}

export async function getStrengthSets(workoutId: number): Promise<StrengthExercise[]> {
  return db
    .select()
    .from(strengthExercise)
    .where(eq(strengthExercise.workoutId, workoutId))
    .orderBy(strengthExercise.exerciseName, strengthExercise.setNumber);
}

export async function getRecentWorkouts(userId: number, limit = 30) {
  return db
    .select({
      workout,
      planned: plannedSession,
    })
    .from(workout)
    .leftJoin(plannedSession, eq(workout.plannedSessionId, plannedSession.id))
    .where(eq(workout.userId, userId))
    .orderBy(desc(workout.startTime))
    .limit(limit);
}

export async function getStrengthSetsForWorkouts(
  workoutIds: number[],
): Promise<StrengthExercise[]> {
  if (workoutIds.length === 0) return [];
  return db
    .select()
    .from(strengthExercise)
    .where(inArray(strengthExercise.workoutId, workoutIds))
    .orderBy(
      strengthExercise.workoutId,
      strengthExercise.exerciseName,
      strengthExercise.setNumber,
    );
}

export async function getLastSetsForExercise(
  userId: number,
  exerciseName: string,
): Promise<StrengthExercise[]> {
  const rows = await db
    .select({
      set: strengthExercise,
      workoutStart: workout.startTime,
    })
    .from(strengthExercise)
    .innerJoin(workout, eq(strengthExercise.workoutId, workout.id))
    .where(
      and(
        eq(workout.userId, userId),
        eq(strengthExercise.exerciseName, exerciseName),
      ),
    )
    .orderBy(desc(workout.startTime), strengthExercise.setNumber)
    .limit(50);

  if (!rows.length) return [];
  const latestWorkoutStart = rows[0].workoutStart?.getTime();
  return rows
    .filter((r) => r.workoutStart?.getTime() === latestWorkoutStart)
    .map((r) => r.set);
}

export async function getRecentBodyMetrics(userId: number, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return db
    .select()
    .from(dailyMetric)
    .where(and(eq(dailyMetric.userId, userId), gte(dailyMetric.date, ymd(cutoff))))
    .orderBy(dailyMetric.date);
}

export function rollingAverage(
  values: (number | null | undefined)[],
  windowSize: number,
): (number | null)[] {
  return values.map((_, i) => {
    const window = values
      .slice(Math.max(0, i - windowSize + 1), i + 1)
      .filter((v): v is number => v != null);
    if (window.length === 0) return null;
    return window.reduce((sum, v) => sum + v, 0) / window.length;
  });
}

export async function getTodayContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user.id);
  if (!plan) return { user, plan: null, session: null, workout: null };
  const today = ymd(new Date());
  const session = await getSessionForDate(plan.id, today);
  const workoutRow = session ? await getWorkoutForPlannedSession(session.id) : null;
  return { user, plan, session, workout: workoutRow };
}

export { weekStart };
