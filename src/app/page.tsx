import { Suspense } from "react";
import { differenceInCalendarWeeks } from "date-fns";
import {
  getLastSetsForExercise,
  getStrengthSets,
  getTodayContext,
  getWorkoutsOnLocalDate,
} from "@/lib/data";

export const dynamic = "force-dynamic";
import { parseYmd, weeksUntil } from "@/lib/date";
import { phaseForWeek } from "@/lib/plan";
import { LogSessionForm } from "@/components/log-session-form";
import { ReopenButton, SkipButton } from "@/components/session-actions";
import { CoachCardSkeleton, DailyCoachCard } from "@/components/coach-cards";
import type { PlannedSession, Workout } from "@/db/schema";

type Prescription = { name: string; sets: number; reps: string }[];

function safeParsePrescription(json: string | null): Prescription | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Prescription) : null;
  } catch {
    return null;
  }
}

export default async function TodayPage() {
  const ctx = await getTodayContext();

  if (!ctx?.user) {
    return (
      <div className="text-center text-muted py-16">
        No user found. Run <code className="text-foreground">npm run db:seed</code>{" "}
        to initialize.
      </div>
    );
  }

  const { user, plan, session, workout, today } = ctx;
  const todayLocal = parseYmd(today);
  const weekNumber = plan
    ? differenceInCalendarWeeks(todayLocal, parseYmd(plan.startDate), {
        weekStartsOn: 1,
      }) + 1
    : null;
  const phase = weekNumber != null ? phaseForWeek(weekNumber) : null;
  const summitRemaining = user.summitDate ? weeksUntil(user.summitDate) : null;
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: user.timezone,
  }).format(new Date());

  const allTodayWorkouts = await getWorkoutsOnLocalDate(
    user.id,
    today,
    user.timezone,
  );
  const extras = allTodayWorkouts.filter(
    (w) => w.plannedSessionId !== (session?.id ?? -1),
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          {dayLabel}
        </div>
        <h1 className="text-2xl font-semibold mt-1">Today</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          {weekNumber != null && <span>Week {weekNumber} of plan</span>}
          {phase && (
            <span>
              Phase {phase.number} · {phase.name}
            </span>
          )}
          {summitRemaining != null && (
            <span>
              <span className="text-foreground">{summitRemaining}</span> weeks
              to Rainier
            </span>
          )}
        </div>
      </section>

      {!session && (
        <div className="rounded-lg border border-panel-border bg-panel p-6">
          <p className="text-muted">
            No planned session for today. Rest, walk, or log freely.
          </p>
        </div>
      )}

      {session && (
        <SessionBlock
          session={session}
          workoutId={workout?.id ?? null}
          userId={user.id}
        />
      )}

      {extras.length > 0 && (
        <ExtrasSection
          workouts={extras}
          plannedStillOpen={session?.status === "planned"}
          plannedTitle={session?.title ?? null}
          plannedCategory={session?.sessionCategory ?? null}
          plannedTargetMin={session?.targetDurationMinutes ?? null}
        />
      )}

      <Suspense fallback={<CoachCardSkeleton label="Coach · thinking" />}>
        <DailyCoachCard
          userId={user.id}
          today={today}
          tz={user.timezone}
          plan={plan ? { id: plan.id, startDate: plan.startDate } : null}
        />
      </Suspense>
    </div>
  );
}

function ExtrasSection({
  workouts,
  plannedStillOpen,
  plannedTitle,
  plannedCategory,
  plannedTargetMin,
}: {
  workouts: Workout[];
  plannedStillOpen: boolean;
  plannedTitle: string | null;
  plannedCategory: string | null;
  plannedTargetMin: number | null;
}) {
  const explanation = plannedStillOpen && plannedTitle && plannedCategory
    ? explainerFor(plannedCategory, plannedTargetMin)
    : null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-muted">
        Also today
      </h3>
      <div className="space-y-2">
        {workouts.map((w) => (
          <ExtraActivityCard key={w.id} workout={w} />
        ))}
      </div>
      {explanation && (
        <p className="text-xs text-muted italic px-1">
          These don't qualify as {plannedTitle} — {explanation}
        </p>
      )}
    </section>
  );
}

function explainerFor(category: string, targetMin: number | null): string {
  const strengthCats = [
    "UPPER_STRENGTH",
    "LOWER_STRENGTH",
    "FULL_BODY_STRENGTH",
    "MOUNTAIN_LEGS",
  ];
  const mountainCats = [
    "STAIRMASTER",
    "INCLINE_TREADMILL",
    "OUTDOOR_HIKE",
    "LOADED_HIKE",
    "LONG_MOUNTAIN_SESSION",
  ];
  if (strengthCats.includes(category)) {
    const min = targetMin != null ? Math.max(15, Math.round(targetMin * 0.5)) : 15;
    return `need a strength/leg session of at least ${min} min. Log manually or import as WeightTraining.`;
  }
  if (mountainCats.includes(category)) {
    const min = targetMin != null ? Math.round(targetMin * 0.7) : 30;
    return `need uphill/mountain-category work (stairs, incline, hike, loaded) of at least ${min} min.`;
  }
  if (category === "EASY_RUN" || category === "QUALITY_RUN" || category === "ZONE2_CARDIO") {
    const min = targetMin != null ? Math.round(targetMin * 0.7) : 30;
    return `need aerobic/run of at least ${min} min.`;
  }
  if (category === "ACTIVE_RECOVERY" || category === "MOBILITY") {
    return `need a matching recovery/mobility session.`;
  }
  return `activity type doesn't match this session's category.`;
}

function ExtraActivityCard({ workout: w }: { workout: Workout }) {
  const min =
    w.durationSeconds != null ? Math.round(w.durationSeconds / 60) : null;
  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(w.startTime);
  return (
    <div className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm truncate">
          {w.type.replaceAll("_", " ").toLowerCase()}
          {w.canonicalSource !== "manual" && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted">
              {w.canonicalSource}
            </span>
          )}
        </div>
        <div className="text-xs text-muted">
          {timeStr}
          {min != null && ` · ${min} min`}
          {w.distanceMeters != null && w.distanceMeters > 0 && (
            <> · {(w.distanceMeters / 1000).toFixed(2)} km</>
          )}
          {w.elevationGainMeters != null && w.elevationGainMeters > 0 && (
            <> · +{Math.round(w.elevationGainMeters)} m</>
          )}
          {w.rpe != null && ` · RPE ${w.rpe}`}
        </div>
      </div>
    </div>
  );
}

async function SessionBlock({
  session,
  workoutId,
  userId,
}: {
  session: PlannedSession;
  workoutId: number | null;
  userId: number;
}) {
  const prescription = safeParsePrescription(session.strengthPrescription);
  const rpeRange =
    session.targetRpeMin != null && session.targetRpeMax != null
      ? session.targetRpeMin === session.targetRpeMax
        ? `RPE ${session.targetRpeMin}`
        : `RPE ${session.targetRpeMin}–${session.targetRpeMax}`
      : null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-panel-border bg-panel p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">
              {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
            </div>
            <h2 className="text-xl font-medium mt-1">{session.title}</h2>
          </div>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {session.targetDurationMinutes != null && (
            <span>
              <span className="text-foreground">
                {session.targetDurationMinutes}
              </span>{" "}
              min
            </span>
          )}
          {rpeRange && <span>{rpeRange}</span>}
          {session.targetPackWeightLb != null && (
            <span>
              Pack{" "}
              <span className="text-foreground">
                {session.targetPackWeightLb}
              </span>{" "}
              lb
            </span>
          )}
          {session.targetElevationGainFt != null && (
            <span>
              +
              <span className="text-foreground">
                {session.targetElevationGainFt}
              </span>{" "}
              ft
            </span>
          )}
        </div>
        {session.instructions && (
          <p className="text-sm leading-relaxed">{session.instructions}</p>
        )}
      </div>

      {session.status === "planned" && (
        <PlannedForm
          plannedSessionId={session.id}
          durationMinutes={session.targetDurationMinutes}
          rpeMin={session.targetRpeMin}
          rpeMax={session.targetRpeMax}
          prescription={prescription}
          userId={userId}
        />
      )}
      {session.status === "completed" && workoutId != null && (
        <WorkoutSummary workoutId={workoutId} plannedSessionId={session.id} />
      )}
      {session.status === "completed" && workoutId == null && (
        <div className="rounded-lg border border-panel-border bg-panel p-4 flex items-center justify-between">
          <span className="text-accent">Marked complete.</span>
          <ReopenButton plannedSessionId={session.id} />
        </div>
      )}
      {session.status === "skipped" && (
        <div className="rounded-lg border border-panel-border bg-panel p-4 flex items-center justify-between">
          <span className="text-warn">Skipped today.</span>
          <ReopenButton plannedSessionId={session.id} />
        </div>
      )}
    </div>
  );
}

async function PlannedForm({
  plannedSessionId,
  durationMinutes,
  rpeMin,
  rpeMax,
  prescription,
  userId,
}: {
  plannedSessionId: number;
  durationMinutes: number | null;
  rpeMin: number | null;
  rpeMax: number | null;
  prescription: Prescription | null;
  userId: number;
}) {
  const prevSetsByExercise: Record<
    string,
    { reps: number | null; weightKg: number | null }[]
  > = {};
  if (prescription) {
    for (const ex of prescription) {
      const rows = await getLastSetsForExercise(userId, ex.name);
      prevSetsByExercise[ex.name] = rows.map((r) => ({
        reps: r.reps,
        weightKg: r.weightKg,
      }));
    }
  }

  return (
    <>
      <LogSessionForm
        plannedSessionId={plannedSessionId}
        defaultDurationMinutes={durationMinutes}
        defaultRpeMin={rpeMin}
        defaultRpeMax={rpeMax}
        prescription={prescription}
        prevSetsByExercise={prevSetsByExercise}
      />
      <div className="flex justify-center">
        <SkipButton plannedSessionId={plannedSessionId} />
      </div>
    </>
  );
}

async function WorkoutSummary({
  workoutId,
  plannedSessionId,
}: {
  workoutId: number;
  plannedSessionId: number;
}) {
  const sets = await getStrengthSets(workoutId);
  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseName) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseName, arr);
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-accent font-medium">Completed</div>
        <ReopenButton plannedSessionId={plannedSessionId} />
      </div>
      {byExercise.size > 0 && (
        <div className="space-y-3 text-sm">
          {[...byExercise.entries()].map(([name, exSets]) => (
            <div key={name}>
              <div className="font-medium">{name}</div>
              <div className="text-muted">
                {exSets
                  .map((s) => `${s.reps ?? "–"}×${s.weightKg ?? "–"}kg`)
                  .join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planned: "bg-panel-border text-muted",
    completed: "bg-accent-strong/20 text-accent",
    skipped: "bg-warn/20 text-warn",
    moved: "bg-panel-border text-muted",
  };
  return (
    <span
      className={`text-xs uppercase tracking-wider rounded px-2 py-1 ${
        styles[status] ?? styles.planned
      }`}
    >
      {status}
    </span>
  );
}
