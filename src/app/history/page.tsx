import { format } from "date-fns";
import {
  getCurrentUser,
  getRecentWorkouts,
  getStrengthSetsForWorkouts,
} from "@/lib/data";
import type { StrengthExercise } from "@/db/schema";

export const dynamic = "force-dynamic";

const LIMIT = 30;

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const rows = await getRecentWorkouts(user.id, LIMIT);
  const sets = await getStrengthSetsForWorkouts(rows.map((r) => r.workout.id));

  const setsByWorkoutId = new Map<number, StrengthExercise[]>();
  for (const s of sets) {
    const arr = setsByWorkoutId.get(s.workoutId) ?? [];
    arr.push(s);
    setsByWorkoutId.set(s.workoutId, arr);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted mt-1">
          Last {LIMIT} workouts · newest first
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-panel-border bg-panel p-6">
          <p className="text-muted">
            No workouts logged yet. Complete a session on the Today tab and it
            will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ workout: w, planned }) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              planned={planned}
              sets={setsByWorkoutId.get(w.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutCard({
  workout,
  planned,
  sets,
}: {
  workout: {
    id: number;
    startTime: Date;
    durationSeconds: number | null;
    rpe: number | null;
    notes: string | null;
    type: string;
    packWeightKg: number | null;
    distanceMeters: number | null;
    elevationGainMeters: number | null;
    averageHr: number | null;
  };
  planned: { title: string; sessionCategory: string } | null;
  sets: StrengthExercise[];
}) {
  const durationMin =
    workout.durationSeconds != null
      ? Math.round(workout.durationSeconds / 60)
      : null;
  const title =
    planned?.title ?? workout.type.replaceAll("_", " ").toLowerCase();

  const groupedSets = groupSets(sets);

  return (
    <article className="rounded-lg border border-panel-border bg-panel p-4 space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">
            {format(workout.startTime, "EEE MMM d · h:mm a")}
          </div>
          <h2 className="text-base font-medium mt-0.5">{title}</h2>
        </div>
        <div className="text-right text-sm text-muted whitespace-nowrap">
          {durationMin != null && (
            <div>
              <span className="text-foreground">{durationMin}</span> min
            </div>
          )}
          {workout.rpe != null && <div>RPE {workout.rpe}</div>}
        </div>
      </header>

      {(workout.packWeightKg != null ||
        workout.distanceMeters != null ||
        workout.elevationGainMeters != null ||
        workout.averageHr != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {workout.packWeightKg != null && (
            <span>Pack {workout.packWeightKg} kg</span>
          )}
          {workout.distanceMeters != null && (
            <span>{(workout.distanceMeters / 1000).toFixed(2)} km</span>
          )}
          {workout.elevationGainMeters != null && (
            <span>+{Math.round(workout.elevationGainMeters)} m</span>
          )}
          {workout.averageHr != null && (
            <span>avg HR {workout.averageHr}</span>
          )}
        </div>
      )}

      {groupedSets.length > 0 && (
        <div className="space-y-1 text-sm">
          {groupedSets.map(({ name, sets: exSets }) => (
            <div key={name} className="flex gap-3">
              <span className="font-medium min-w-40 max-w-56 truncate">
                {name}
              </span>
              <span className="text-muted flex-1">
                {exSets
                  .map(
                    (s) => `${s.reps ?? "–"}×${s.weightKg ?? "–"}kg`,
                  )
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {workout.notes && (
        <p className="text-sm text-muted italic leading-relaxed">
          "{workout.notes}"
        </p>
      )}
    </article>
  );
}

function groupSets(sets: StrengthExercise[]) {
  const map = new Map<string, StrengthExercise[]>();
  for (const s of sets) {
    const arr = map.get(s.exerciseName) ?? [];
    arr.push(s);
    map.set(s.exerciseName, arr);
  }
  return [...map.entries()].map(([name, exSets]) => ({ name, sets: exSets }));
}
