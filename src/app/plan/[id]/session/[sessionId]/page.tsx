import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  strengthExercise,
  trainingPlan,
  workout,
} from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { PlannedDetails } from "@/components/plan/planned-details";
import { SessionIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const planId = Number(id);
  const sid = Number(sessionId);
  if (!Number.isFinite(planId) || !Number.isFinite(sid)) notFound();

  const user = await requireOnboardedUser();

  const [session] = await db
    .select()
    .from(plannedSession)
    .innerJoin(trainingPlan, eq(trainingPlan.id, plannedSession.planId))
    .where(
      and(
        eq(plannedSession.id, sid),
        eq(plannedSession.planId, planId),
        eq(trainingPlan.userId, user.id),
      ),
    )
    .limit(1);
  if (!session) notFound();

  const s = session.planned_session;
  const plan = session.training_plan;

  // History: all workouts of this same category for this user, most
  // recent first. Lets the user see how they've historically done
  // "Upper Body A" or "Long Rainier Session" — useful for pacing.
  const history = await db
    .select({
      id: workout.id,
      startTime: workout.startTime,
      durationSeconds: workout.durationSeconds,
      distanceMeters: workout.distanceMeters,
      elevationGainMeters: workout.elevationGainMeters,
      rpe: workout.rpe,
      averageHr: workout.averageHr,
      notes: workout.notes,
      sourceName: workout.sourceName,
      canonicalSource: workout.canonicalSource,
      plannedSessionId: workout.plannedSessionId,
    })
    .from(workout)
    .where(
      and(eq(workout.userId, user.id), eq(workout.type, s.sessionCategory)),
    )
    .orderBy(desc(workout.startTime))
    .limit(20);

  // Was this specific session completed?
  const linkedWorkout = history.find((w) => w.plannedSessionId === s.id);
  const strengthSets = linkedWorkout
    ? await db
        .select()
        .from(strengthExercise)
        .where(eq(strengthExercise.workoutId, linkedWorkout.id))
        .orderBy(asc(strengthExercise.setNumber))
    : [];

  return (
    <div className="space-y-6">
      <section>
        <Link
          href={`/plan/${plan.id}`}
          className="text-xs text-muted hover:text-foreground"
        >
          ← {plan.name}
        </Link>
        <div className="flex items-baseline gap-2 mt-2">
          <SessionIcon
            category={s.sessionCategory}
            size={20}
            className="text-blue-300"
          />
          <h1 className="text-2xl font-semibold">{s.title}</h1>
        </div>
        <p className="text-sm text-muted mt-1">
          {new Date(s.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {s.targetDurationMinutes && ` · ${s.targetDurationMinutes} min`}
          {s.targetRpeMin != null && s.targetRpeMax != null && (
            <>
              {" "}
              · RPE{" "}
              {s.targetRpeMin === s.targetRpeMax
                ? s.targetRpeMin
                : `${s.targetRpeMin}-${s.targetRpeMax}`}
            </>
          )}
        </p>
      </section>

      <PlannedDetails session={s} />

      {linkedWorkout && (
        <section className="rounded-lg border border-accent/40 bg-accent-strong/5 p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent">
            ✓ Completed
          </div>
          <div className="text-sm">
            {linkedWorkout.sourceName ?? "Logged workout"}
            {linkedWorkout.durationSeconds && (
              <span className="text-muted">
                {" "}
                · {Math.round(linkedWorkout.durationSeconds / 60)} min
              </span>
            )}
            {linkedWorkout.rpe != null && (
              <span className="text-muted"> · RPE {linkedWorkout.rpe}</span>
            )}
            {linkedWorkout.averageHr != null && (
              <span className="text-muted">
                {" "}
                · avg HR {linkedWorkout.averageHr}
              </span>
            )}
          </div>
          {linkedWorkout.notes && (
            <p className="text-xs text-muted italic">
              &ldquo;{linkedWorkout.notes}&rdquo;
            </p>
          )}
          {strengthSets.length > 0 && (
            <details className="pt-2 border-t border-panel-border/60">
              <summary className="text-xs text-blue-300 cursor-pointer">
                {strengthSets.length} sets logged
              </summary>
              <div className="mt-2 space-y-0.5 text-xs font-mono tabular-nums">
                {strengthSets.map((set) => (
                  <div key={set.id} className="flex gap-3">
                    <span className="w-6 text-muted">#{set.setNumber}</span>
                    <span className="flex-1 truncate">{set.exerciseName}</span>
                    <span>{set.reps ?? "—"} reps</span>
                    {set.weightKg != null && (
                      <span className="text-muted">
                        · {set.weightKg} kg
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Your history of {s.sessionCategory.replaceAll("_", " ").toLowerCase()}
          </div>
          <div className="rounded-md border border-panel-border bg-panel/40 divide-y divide-panel-border/60">
            {history.map((w) => (
              <div key={w.id} className="flex items-baseline gap-3 px-3 py-2 text-xs">
                <span className="w-16 text-muted tabular-nums shrink-0">
                  {new Date(w.startTime).toISOString().slice(5, 10)}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {w.sourceName ?? "(unnamed)"}
                </span>
                {w.durationSeconds && (
                  <span className="text-muted tabular-nums shrink-0">
                    {Math.round(w.durationSeconds / 60)}m
                  </span>
                )}
                {w.rpe != null && (
                  <span className="text-blue-300 tabular-nums shrink-0">
                    RPE {w.rpe}
                  </span>
                )}
                <span className="text-[10px] text-muted uppercase w-10 text-right shrink-0">
                  {w.canonicalSource}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
