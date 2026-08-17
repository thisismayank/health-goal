import Link from "next/link";
import { format } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { strengthExercise, type StrengthExercise, type Workout } from "@/db/schema";
import {
  getActivePlan,
  requireOnboardedUser,
  getWeekSessions,
  getWeekWorkouts,
} from "@/lib/data";
import { DAY_LABELS, todayInTimeZone, weekDays, weekStart, ymd } from "@/lib/date";
import type { PlannedSession } from "@/db/schema";
import { PlannedDetails } from "@/components/plan/planned-details";
import { InlineSessionActions } from "@/components/plan/inline-actions";
import { PlanSubNav } from "@/components/shell/plan-sub-nav";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const user = await requireOnboardedUser();
  const plan = await getActivePlan(user.id);
  if (!plan) {
    return (
      <div className="space-y-3">
        <p className="text-muted">No active training plan.</p>
        <Link
          href="/plan/new"
          className="inline-block rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2"
        >
          Create one →
        </Link>
      </div>
    );
  }

  const anchor = new Date();
  const days = weekDays(anchor);
  const sessions = await getWeekSessions(plan.id, anchor);
  const workouts = await getWeekWorkouts(user.id, anchor);

  const sessionByDate = new Map(sessions.map((s) => [s.date, s]));
  const workoutBySession = new Map(
    workouts
      .filter((w) => w.plannedSessionId != null)
      .map((w) => [w.plannedSessionId as number, w]),
  );

  // Extras: workouts logged today that AREN'T tied to a planned session
  // (bonus walks, second sessions, etc.). Grouped by local date so they
  // render under the right day.
  const extrasByDate = new Map<string, Workout[]>();
  const tz = user.timezone;
  for (const w of workouts) {
    if (w.plannedSessionId != null) continue;
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(w.startTime);
    const list = extrasByDate.get(dateStr) ?? [];
    list.push(w);
    extrasByDate.set(dateStr, list);
  }

  // Batch-load all strength sets for this week's workouts in one query.
  const workoutIds = workouts.map((w) => w.id);
  const strengthRows =
    workoutIds.length > 0
      ? await db
          .select()
          .from(strengthExercise)
          .where(inArray(strengthExercise.workoutId, workoutIds))
      : [];
  const setsByWorkout = new Map<number, StrengthExercise[]>();
  for (const s of strengthRows) {
    const list = setsByWorkout.get(s.workoutId) ?? [];
    list.push(s);
    setsByWorkout.set(s.workoutId, list);
  }
  for (const list of setsByWorkout.values()) {
    list.sort((a, b) => a.setNumber - b.setNumber);
  }

  const today = todayInTimeZone(user.timezone);
  const passed = sessions.filter((s) => s.date <= today);
  const completed = passed.filter((s) => s.status === "completed");
  const plannedTotalMin = sessions.reduce(
    (sum, s) => sum + (s.targetDurationMinutes ?? 0),
    0,
  );
  const actualTotalMin = workouts.reduce(
    (sum, w) => sum + Math.round((w.durationSeconds ?? 0) / 60),
    0,
  );
  const compliance =
    passed.length === 0 ? 0 : Math.round((completed.length / passed.length) * 100);

  const start = weekStart(anchor);

  return (
    <div className="space-y-5">
      <PlanSubNav />
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Week of {format(start, "MMM d")}
        </div>
        <h1 className="text-2xl font-semibold mt-0.5">Training week</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          <span>
            <span className="text-foreground">{completed.length}</span> /{" "}
            {sessions.length} sessions
          </span>
          <span>
            <span className="text-foreground">{compliance}%</span> compliance so
            far
          </span>
          <span>
            <span className="text-foreground">{actualTotalMin}</span> /{" "}
            {plannedTotalMin} min
          </span>
        </div>
      </section>

      <div className="space-y-3">
        {days.map((d, i) => {
          const dateStr = ymd(d);
          const session = sessionByDate.get(dateStr);
          const workout = session ? workoutBySession.get(session.id) : null;
          const strengthSets =
            workout ? setsByWorkout.get(workout.id) ?? [] : [];
          const extras = extrasByDate.get(dateStr) ?? [];
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          return (
            <DayCard
              key={dateStr}
              dayLabel={DAY_LABELS[i]}
              dateLabel={format(d, "d")}
              isToday={isToday}
              isFuture={isFuture}
              session={session ?? null}
              workout={workout ?? null}
              strengthSets={strengthSets}
              extras={extras}
              extraSets={setsByWorkout}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href="/history"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Workout history →
        </Link>
        <Link
          href="/body"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Log body metrics →
        </Link>
      </div>
    </div>
  );
}

function DayCard({
  dayLabel,
  dateLabel,
  isToday,
  isFuture,
  session,
  workout,
  strengthSets,
  extras,
  extraSets,
}: {
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isFuture: boolean;
  session: PlannedSession | null;
  workout: Workout | null;
  strengthSets: StrengthExercise[];
  extras: Workout[];
  extraSets: Map<number, StrengthExercise[]>;
}) {
  const border = isToday
    ? "border-blue-500/60 bg-blue-950/10"
    : "border-panel-border bg-panel/60";

  return (
    <div className={`rounded-lg border ${border} p-4 space-y-3`}>
      <div className="flex items-baseline gap-4">
        <div className="w-14 text-center shrink-0">
          <div className="text-xs uppercase text-muted">{dayLabel}</div>
          <div
            className={`text-xl font-semibold ${isToday ? "text-blue-300" : ""}`}
          >
            {dateLabel}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {session ? (
            <SessionHeader session={session} workout={workout} />
          ) : (
            <div className="text-sm text-muted">No planned session</div>
          )}
        </div>
        <StatusChip status={session?.status ?? "none"} />
      </div>

      {session && <PlannedDetails session={session} variant="inset" />}

      {workout && <WorkoutDetails workout={workout} sets={strengthSets} />}

      {session && workout && workout.type !== session.sessionCategory && (
        <div className="pl-[calc(3.5rem+1rem)] text-[10px] font-mono uppercase tracking-wider text-blue-300/70">
          counts as → {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
        </div>
      )}

      {session && (
        <div className="flex justify-end pt-1 border-t border-panel-border/50">
          <InlineSessionActions
            plannedSessionId={session.id}
            targetDurationMinutes={session.targetDurationMinutes}
            status={session.status}
            isFuture={isFuture}
            hasImportedWorkout={
              workout != null && workout.canonicalSource !== "manual"
            }
          />
        </div>
      )}

      {extras.length > 0 && (
        <div className="pt-2 border-t border-panel-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Also logged today
          </div>
          {extras.map((e) => (
            <div key={e.id} className="pl-4">
              <WorkoutDetails
                workout={e}
                sets={extraSets.get(e.id) ?? []}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionHeader({
  session,
  workout,
}: {
  session: PlannedSession;
  workout: Workout | null;
}) {
  const rpeRange =
    session.targetRpeMin != null && session.targetRpeMax != null
      ? session.targetRpeMin === session.targetRpeMax
        ? `RPE ${session.targetRpeMin}`
        : `RPE ${session.targetRpeMin}–${session.targetRpeMax}`
      : null;

  return (
    <>
      <div className="text-sm truncate">{session.title}</div>
      <div className="text-xs text-muted flex flex-wrap gap-x-2 gap-y-0.5">
        <span className="uppercase tracking-wider text-[10px]">
          {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
        </span>
        <span>·</span>
        <span>
          <span className="text-foreground">
            {session.targetDurationMinutes ?? "–"}
          </span>{" "}
          min
        </span>
        {rpeRange && <span>· {rpeRange}</span>}
        {session.targetElevationGainFt != null && (
          <span>· +{session.targetElevationGainFt.toLocaleString()} ft</span>
        )}
        {session.targetPackWeightLb != null && (
          <span>· {session.targetPackWeightLb} lb pack</span>
        )}
        {workout?.durationSeconds != null && (
          <span className="text-blue-300">
            · actual {Math.round(workout.durationSeconds / 60)}m
          </span>
        )}
        {workout?.rpe != null && (
          <span className="text-blue-300">· RPE {workout.rpe}</span>
        )}
      </div>
    </>
  );
}

function WorkoutDetails({
  workout,
  sets,
  compact = false,
}: {
  workout: Workout;
  sets: StrengthExercise[];
  compact?: boolean;
}) {
  const dist =
    workout.distanceMeters != null && workout.distanceMeters > 0
      ? `${(workout.distanceMeters / 1000).toFixed(2)} km`
      : null;
  const gain =
    workout.elevationGainMeters != null && workout.elevationGainMeters > 0
      ? `+${Math.round(workout.elevationGainMeters * 3.281)} ft`
      : null;
  const pack =
    workout.packWeightKg != null && workout.packWeightKg > 0
      ? `${Math.round(workout.packWeightKg * 2.205)} lb pack`
      : null;
  const pace =
    workout.distanceMeters != null &&
    workout.distanceMeters > 500 &&
    workout.durationSeconds != null &&
    workout.durationSeconds > 0
      ? paceLabel(workout.distanceMeters, workout.durationSeconds)
      : null;
  const type = workout.type.replaceAll("_", " ").toLowerCase();

  return (
    <div className={compact ? "space-y-1" : "space-y-2 pl-[calc(3.5rem+1rem)]"}>
      <div
        className={`text-xs text-muted flex flex-wrap gap-x-2 gap-y-0.5 ${compact ? "" : ""}`}
      >
        <span className="text-foreground font-mono">{type}</span>
        {dist && <span>· {dist}</span>}
        {gain && <span>· {gain}</span>}
        {pace && <span>· {pace}</span>}
        {workout.averageHr != null && (
          <span>· avg {workout.averageHr} bpm</span>
        )}
        {workout.maxHr != null && (
          <span>· max {workout.maxHr} bpm</span>
        )}
        {pack && <span>· {pack}</span>}
        {workout.canonicalSource !== "manual" && (
          <span className="text-[10px] uppercase tracking-wider text-muted">
            · {workout.canonicalSource}
          </span>
        )}
      </div>

      {sets.length > 0 && <StrengthTable sets={sets} />}

      {workout.notes && (
        <p className="text-xs text-muted italic">"{workout.notes}"</p>
      )}
    </div>
  );
}

function StrengthTable({ sets }: { sets: StrengthExercise[] }) {
  // Group by exercise, preserving first-seen order.
  const byName = new Map<string, StrengthExercise[]>();
  const order: string[] = [];
  for (const s of sets) {
    if (!byName.has(s.exerciseName)) {
      byName.set(s.exerciseName, []);
      order.push(s.exerciseName);
    }
    byName.get(s.exerciseName)!.push(s);
  }

  return (
    <div className="rounded-md border border-panel-border bg-background/40 p-2 space-y-1.5">
      {order.map((name) => {
        const rows = byName.get(name)!;
        return (
          <div key={name} className="text-xs">
            <div className="font-medium text-foreground">{name}</div>
            <div className="text-muted flex flex-wrap gap-x-2 mt-0.5 tabular-nums">
              {rows.map((r, i) => (
                <span key={i}>
                  {r.reps != null ? r.reps : "–"}
                  {r.weightKg != null ? ` × ${r.weightKg}kg` : ""}
                  {r.rpe != null ? ` @${r.rpe}` : ""}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function paceLabel(meters: number, seconds: number): string {
  const minutesPerKm = seconds / 60 / (meters / 1000);
  const min = Math.floor(minutesPerKm);
  const sec = Math.round((minutesPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    planned: { label: "planned", className: "bg-panel-border text-muted" },
    completed: {
      label: "done",
      className: "bg-accent-strong/20 text-accent",
    },
    skipped: { label: "skipped", className: "bg-warn/20 text-warn" },
    moved: { label: "moved", className: "bg-panel-border text-muted" },
    none: { label: "—", className: "text-muted" },
  };
  const s = map[status] ?? map.planned;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider rounded px-2 py-1 whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
