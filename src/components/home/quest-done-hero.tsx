import Link from "next/link";
import { ReopenButton } from "@/components/session-actions";
import { getStrengthSets } from "@/lib/data";
import type { PlannedSession, Workout } from "@/db/schema";

export async function QuestDoneHero({
  session,
  workout,
  tomorrowSession,
}: {
  session: PlannedSession;
  workout: Workout | null;
  tomorrowSession: PlannedSession | null;
}) {
  const actualMin =
    workout?.durationSeconds != null
      ? Math.round(workout.durationSeconds / 60)
      : null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-accent">
              [QUEST · COMPLETE]
            </div>
            <div className="text-xs uppercase tracking-widest text-muted mt-1">
              {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
            </div>
            <h2 className="text-xl font-medium mt-1 leading-tight">
              {session.title}
            </h2>
          </div>
          <span className="text-xs uppercase tracking-wider rounded px-2 py-1 bg-accent-strong/20 text-accent shrink-0">
            done
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {actualMin != null && (
            <span>
              <span className="text-foreground">{actualMin}</span> min actual
              {session.targetDurationMinutes != null && (
                <span className="text-muted">
                  {" "}/ {session.targetDurationMinutes} planned
                </span>
              )}
            </span>
          )}
          {workout?.rpe != null && <span>RPE {workout.rpe}</span>}
          {workout?.distanceMeters != null && workout.distanceMeters > 0 && (
            <span>{(workout.distanceMeters / 1000).toFixed(2)} km</span>
          )}
          {workout?.elevationGainMeters != null &&
            workout.elevationGainMeters > 0 && (
              <span>+{Math.round(workout.elevationGainMeters)} m</span>
            )}
        </div>
        {workout && workout.id != null && (
          <StrengthSummary workoutId={workout.id} />
        )}
        <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between">
          <Link
            href="/progress"
            className="text-xs text-blue-300 hover:underline"
          >
            See how this moved you →
          </Link>
          <ReopenButton plannedSessionId={session.id} />
        </div>
      </section>

      {tomorrowSession && (
        <TomorrowTeaser session={tomorrowSession} />
      )}
    </div>
  );
}

async function StrengthSummary({ workoutId }: { workoutId: number }) {
  const sets = await getStrengthSets(workoutId);
  if (sets.length === 0) return null;

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseName) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseName, arr);
  }

  return (
    <div className="space-y-2 text-sm">
      {[...byExercise.entries()].map(([name, exSets]) => (
        <div key={name}>
          <div className="font-medium">{name}</div>
          <div className="text-muted text-xs">
            {exSets
              .map((s) => `${s.reps ?? "–"}×${s.weightKg ?? "–"}kg`)
              .join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TomorrowTeaser({ session }: { session: PlannedSession }) {
  return (
    <Link
      href="/train"
      className="block rounded-lg border border-panel-border bg-panel/60 px-4 py-3 hover:border-blue-500/40 transition"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Tomorrow
          </div>
          <div className="text-sm font-medium mt-0.5 truncate">
            {session.title}
          </div>
        </div>
        <div className="text-xs text-muted whitespace-nowrap tabular-nums">
          {session.targetDurationMinutes != null
            ? `${session.targetDurationMinutes} min`
            : "—"}
        </div>
      </div>
    </Link>
  );
}
