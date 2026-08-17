import { format } from "date-fns";
import {
  requireOnboardedUser,
  getRecentWorkouts,
  getStrengthSetsForWorkouts,
} from "@/lib/data";
import type { StrengthExercise } from "@/db/schema";
import { PlanSubNav } from "@/components/shell/plan-sub-nav";
import {
  formatDistance,
  formatElevation,
  formatBodyWeightKg,
  pickUnits,
  type Units,
} from "@/lib/units";

export const dynamic = "force-dynamic";

const LIMIT = 30;

export default async function HistoryPage() {
  const user = await requireOnboardedUser();
  const units = pickUnits(user);

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
      <PlanSubNav />
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
              units={units}
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
  units,
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
    canonicalSource: string;
  };
  planned: { title: string; sessionCategory: string } | null;
  sets: StrengthExercise[];
  units: Units;
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
          <div className="text-xs uppercase tracking-widest text-muted flex items-center gap-2">
            <span>{format(workout.startTime, "EEE MMM d · h:mm a")}</span>
            <SourceBadge source={workout.canonicalSource} />
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

      {/* Metric row — only render if there's real data. Manual
          completions have no distance / elevation / HR and previously
          rendered '0.00 mi +0 ft' next to real GPS activities, which
          made the feed unreadable. */}
      {((workout.packWeightKg != null && workout.packWeightKg > 0) ||
        (workout.distanceMeters != null && workout.distanceMeters > 0) ||
        (workout.elevationGainMeters != null &&
          workout.elevationGainMeters > 0) ||
        workout.averageHr != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {workout.packWeightKg != null && workout.packWeightKg > 0 && (
            <span>Pack {formatBodyWeightKg(workout.packWeightKg, units)}</span>
          )}
          {workout.distanceMeters != null && workout.distanceMeters > 0 && (
            <span>{formatDistance(workout.distanceMeters, units)}</span>
          )}
          {workout.elevationGainMeters != null &&
            workout.elevationGainMeters > 0 && (
              <span>
                +{formatElevation(workout.elevationGainMeters, units)}
              </span>
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

function SourceBadge({ source }: { source: string }) {
  // Distinguish manually-marked completions from real device imports.
  // Devin round 2: "plan sessions currently show 0.00 mi +0 ft next
  // to real GPS activities" — the missing visual cue was the biggest
  // cause of feed unreadability.
  const meta: Record<string, { label: string; tone: string }> = {
    manual: { label: "logged", tone: "text-blue-300/80 border-blue-500/30" },
    strava: { label: "strava", tone: "text-muted border-panel-border" },
    intervals: {
      label: "intervals",
      tone: "text-muted border-panel-border",
    },
    healthkit: { label: "health", tone: "text-muted border-panel-border" },
    garmin: { label: "garmin", tone: "text-muted border-panel-border" },
  };
  const m = meta[source] ?? { label: source, tone: "text-muted border-panel-border" };
  return (
    <span
      className={`text-[9px] font-mono uppercase tracking-wider border rounded px-1 py-0.5 ${m.tone}`}
    >
      {m.label}
    </span>
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
