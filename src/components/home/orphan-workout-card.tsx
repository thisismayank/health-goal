import { and, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { plannedSession, trainingPlan, workout } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import { OrphanConfirm } from "./orphan-workout-client";

/**
 * Server-side scan for the most recent orphan workout that has a
 * close-but-not-linked planned session in the same week. Surfaces
 * a one-tap 'was this it?' confirmation on Home.
 *
 * Deliberately narrow: only shows if there's a genuine candidate.
 * Orphan Sunday walks or workouts on rest days won't nag; only
 * activities that could plausibly be a specific session.
 */
export async function OrphanWorkoutCard() {
  const user = await requireCurrentUser();
  const [plan] = await db
    .select({ id: trainingPlan.id })
    .from(trainingPlan)
    .where(
      and(eq(trainingPlan.userId, user.id), eq(trainingPlan.status, "active")),
    )
    .limit(1);
  if (!plan) return null;

  const since = new Date(Date.now() - 7 * 86400_000);

  // Find the most recent orphan workout in the last 7 days.
  const orphans = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, user.id),
        gte(workout.startTime, since),
        isNull(workout.plannedSessionId),
      ),
    )
    .orderBy(desc(workout.startTime))
    .limit(10);

  for (const w of orphans) {
    const ymd = w.startTime.toISOString().slice(0, 10);
    const [ps] = await db
      .select()
      .from(plannedSession)
      .where(
        and(eq(plannedSession.planId, plan.id), eq(plannedSession.date, ymd)),
      )
      .limit(1);
    if (!ps) continue;

    // Only surface if the planned session doesn't already have another
    // linked workout — we don't want to compete with an existing link.
    const [existingLink] = await db
      .select({ id: workout.id })
      .from(workout)
      .where(
        and(
          eq(workout.userId, user.id),
          eq(workout.plannedSessionId, ps.id),
          ne(workout.id, w.id),
        ),
      )
      .limit(1);
    if (existingLink) continue;

    return (
      <OrphanConfirm
        workoutId={w.id}
        workoutName={w.sourceName ?? w.type.replaceAll("_", " ")}
        workoutDate={ymd}
        durationMinutes={
          w.durationSeconds ? Math.round(w.durationSeconds / 60) : null
        }
        plannedSessionId={ps.id}
        plannedTitle={ps.title}
        plannedCategory={ps.sessionCategory}
      />
    );
  }
  return null;
}
