import { and, eq, gte, lte } from "drizzle-orm";
import { addDays, differenceInCalendarWeeks } from "date-fns";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  workout,
  type PlannedSession,
  type SessionCategory,
  type Workout,
} from "@/db/schema";
import { getWorkoutsOnLocalDate } from "@/lib/data";
import { parseYmd, weekDays, weekStart, ymd, ymdInTimeZone } from "@/lib/date";
import {
  phaseForWeek,
  sessionCompletionQualifies,
  type Phase,
} from "@/lib/plan";

const RUNNING_CATEGORIES: SessionCategory[] = ["EASY_RUN", "QUALITY_RUN"];
const AEROBIC_CATEGORIES: SessionCategory[] = [
  "EASY_RUN",
  "QUALITY_RUN",
  "ZONE2_CARDIO",
];
const STRENGTH_CATEGORIES: SessionCategory[] = [
  "UPPER_STRENGTH",
  "LOWER_STRENGTH",
  "FULL_BODY_STRENGTH",
  "MOUNTAIN_LEGS",
];
const MOUNTAIN_CATEGORIES: SessionCategory[] = [
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
];

export type DailyRollup = {
  date: string;
  weekday: string;
  weekNumber: number | null;
  phase: { number: number; name: string } | null;
  planned: {
    category: SessionCategory;
    title: string;
    targetDurationMinutes: number | null;
    targetPackWeightLb: number | null;
    targetElevationGainFt: number | null;
    targetRpeMin: number | null;
    targetRpeMax: number | null;
    status: string;
    instructions: string | null;
  } | null;
  workouts: Array<{
    category: SessionCategory;
    source: string;
    startTimeIso: string;
    durationMinutes: number | null;
    distanceKm: number | null;
    elevationGainM: number | null;
    averageHr: number | null;
    rpe: number | null;
    notes: string | null;
    linkedToPlan: boolean;
    qualifiesForPlan: boolean;
  }>;
  extrasCount: number;
  qualifyingWorkoutExists: boolean;
  bodyWeightKg: number | null;
  fatigue1to10: number | null;
  daySummary: {
    totalMinutes: number;
    aerobicMinutes: number;
    strengthMinutes: number;
    mountainMinutes: number;
    elevationGainM: number;
    averageRpe: number | null;
  };
};

function workoutDurationMin(w: Workout): number {
  return w.durationSeconds != null ? Math.round(w.durationSeconds / 60) : 0;
}

export async function getDailyRollup(
  userId: number,
  dateYmd: string,
  tz: string,
  plan: { id: number; startDate: string } | null,
): Promise<DailyRollup> {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: tz,
  }).format(parseYmd(dateYmd));

  const weekNumber = plan
    ? differenceInCalendarWeeks(parseYmd(dateYmd), parseYmd(plan.startDate), {
        weekStartsOn: 1,
      }) + 1
    : null;
  const phase = weekNumber != null ? phaseForWeek(weekNumber) : null;

  const ps = plan
    ? (
        await db
          .select()
          .from(plannedSession)
          .where(
            and(
              eq(plannedSession.planId, plan.id),
              eq(plannedSession.date, dateYmd),
            ),
          )
          .limit(1)
      )[0]
    : undefined;

  const dayWorkouts = await getWorkoutsOnLocalDate(userId, dateYmd, tz);

  const rows = dayWorkouts.map((w) => {
    const qualifies = ps
      ? sessionCompletionQualifies(w.durationSeconds, w.type as SessionCategory, ps)
      : false;
    return {
      category: w.type as SessionCategory,
      source: w.canonicalSource,
      startTimeIso: w.startTime.toISOString(),
      durationMinutes: w.durationSeconds != null ? Math.round(w.durationSeconds / 60) : null,
      distanceKm: w.distanceMeters != null ? +(w.distanceMeters / 1000).toFixed(2) : null,
      elevationGainM: w.elevationGainMeters != null ? Math.round(w.elevationGainMeters) : null,
      averageHr: w.averageHr,
      rpe: w.rpe,
      notes: w.notes,
      linkedToPlan: w.plannedSessionId === (ps?.id ?? -1),
      qualifiesForPlan: qualifies,
    };
  });

  const totalMinutes = dayWorkouts.reduce((s, w) => s + workoutDurationMin(w), 0);
  const aerobicMinutes = dayWorkouts
    .filter((w) => AEROBIC_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const strengthMinutes = dayWorkouts
    .filter((w) => STRENGTH_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const mountainMinutes = dayWorkouts
    .filter((w) => MOUNTAIN_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const elevationGainM = dayWorkouts.reduce(
    (s, w) => s + (w.elevationGainMeters ?? 0),
    0,
  );
  const rpes = dayWorkouts.map((w) => w.rpe).filter((r): r is number => r != null);
  const averageRpe = rpes.length
    ? +(rpes.reduce((s, r) => s + r, 0) / rpes.length).toFixed(1)
    : null;

  const metric = (
    await db
      .select()
      .from(dailyMetric)
      .where(and(eq(dailyMetric.userId, userId), eq(dailyMetric.date, dateYmd)))
      .limit(1)
  )[0];

  return {
    date: dateYmd,
    weekday,
    weekNumber,
    phase: phase ? { number: phase.number, name: phase.name } : null,
    planned: ps
      ? {
          category: ps.sessionCategory,
          title: ps.title,
          targetDurationMinutes: ps.targetDurationMinutes,
          targetPackWeightLb: ps.targetPackWeightLb,
          targetElevationGainFt: ps.targetElevationGainFt,
          targetRpeMin: ps.targetRpeMin,
          targetRpeMax: ps.targetRpeMax,
          status: ps.status,
          instructions: ps.instructions,
        }
      : null,
    workouts: rows,
    extrasCount: rows.filter((r) => !r.linkedToPlan).length,
    qualifyingWorkoutExists: rows.some((r) => r.qualifiesForPlan),
    bodyWeightKg: metric?.bodyWeightKg ?? null,
    fatigue1to10: metric?.fatigue1to10 ?? null,
    daySummary: {
      totalMinutes,
      aerobicMinutes,
      strengthMinutes,
      mountainMinutes,
      elevationGainM: Math.round(elevationGainM),
      averageRpe,
    },
  };
}

export type WeeklyRollup = {
  weekStart: string;
  weekNumber: number | null;
  phase: { number: number; name: string } | null;
  planned: {
    sessions: number;
    strengthSessions: number;
    totalMinutes: number;
    longSessionMinutes: number | null;
    longSessionPackLb: number | null;
    longSessionElevationFt: number | null;
  };
  actual: {
    sessions: number;
    strengthSessions: number;
    totalMinutes: number;
    aerobicMinutes: number;
    runningMinutes: number;
    mountainMinutes: number;
    elevationGainM: number;
    longestSessionMinutes: number | null;
    averageRpe: number | null;
    maxPackWeightKg: number | null;
    extrasCount: number;
  };
  compliance: {
    completed: number;
    skipped: number;
    passed: number;
    total: number;
    percent: number;
  };
  weightTrend: {
    startKg: number | null;
    endKg: number | null;
    deltaKg: number | null;
  };
  averageFatigue: number | null;
  flags: string[];
};

export async function getWeeklyRollup(
  userId: number,
  anchor: Date,
  tz: string,
  plan: { id: number; startDate: string } | null,
): Promise<WeeklyRollup> {
  const days = weekDays(anchor);
  const startYmd = ymd(days[0]);
  const endYmd = ymd(days[6]);
  const todayYmdStr = ymdInTimeZone(new Date(), tz);

  const weekNumber = plan
    ? differenceInCalendarWeeks(days[0], parseYmd(plan.startDate), {
        weekStartsOn: 1,
      }) + 1
    : null;
  const phase = weekNumber != null ? phaseForWeek(weekNumber) : null;

  const plannedRows: PlannedSession[] = plan
    ? await db
        .select()
        .from(plannedSession)
        .where(
          and(
            eq(plannedSession.planId, plan.id),
            gte(plannedSession.date, startYmd),
            lte(plannedSession.date, endYmd),
          ),
        )
    : [];

  const startOfDayTz = new Date(days[0]);
  startOfDayTz.setHours(0, 0, 0, 0);
  const endOfDayTz = new Date(days[6]);
  endOfDayTz.setHours(23, 59, 59, 999);

  const workouts = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, userId),
        gte(workout.startTime, startOfDayTz),
        lte(workout.startTime, endOfDayTz),
      ),
    );

  const plannedLong = plannedRows.find(
    (p) => p.sessionCategory === "LONG_MOUNTAIN_SESSION",
  );
  const plannedSessions = plannedRows.length;
  const plannedStrengthSessions = plannedRows.filter((p) =>
    STRENGTH_CATEGORIES.includes(p.sessionCategory),
  ).length;
  const plannedTotalMin = plannedRows.reduce(
    (s, p) => s + (p.targetDurationMinutes ?? 0),
    0,
  );

  const passed = plannedRows.filter((p) => p.date <= todayYmdStr);
  const completed = passed.filter((p) => p.status === "completed");
  const skipped = passed.filter((p) => p.status === "skipped");
  const compliancePct =
    passed.length === 0
      ? 0
      : Math.round((completed.length / passed.length) * 100);

  const actualTotalMin = workouts.reduce((s, w) => s + workoutDurationMin(w), 0);
  const aerobicMin = workouts
    .filter((w) => AEROBIC_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const runningMin = workouts
    .filter((w) => RUNNING_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const mountainMin = workouts
    .filter((w) => MOUNTAIN_CATEGORIES.includes(w.type as SessionCategory))
    .reduce((s, w) => s + workoutDurationMin(w), 0);
  const strengthWorkoutCount = workouts.filter((w) =>
    STRENGTH_CATEGORIES.includes(w.type as SessionCategory),
  ).length;
  const elevationM = workouts.reduce(
    (s, w) => s + (w.elevationGainMeters ?? 0),
    0,
  );
  const longest = workouts.reduce(
    (max, w) => Math.max(max, workoutDurationMin(w)),
    0,
  );
  const rpes = workouts.map((w) => w.rpe).filter((r): r is number => r != null);
  const avgRpe = rpes.length
    ? +(rpes.reduce((s, r) => s + r, 0) / rpes.length).toFixed(1)
    : null;
  const packWeights = workouts
    .map((w) => w.packWeightKg)
    .filter((p): p is number => p != null);
  const maxPack = packWeights.length ? Math.max(...packWeights) : null;
  const extras = workouts.filter((w) => w.plannedSessionId == null).length;

  const metrics = await db
    .select()
    .from(dailyMetric)
    .where(
      and(
        eq(dailyMetric.userId, userId),
        gte(dailyMetric.date, startYmd),
        lte(dailyMetric.date, endYmd),
      ),
    );
  const weights = metrics.map((m) => m.bodyWeightKg).filter((w): w is number => w != null);
  const fatigues = metrics
    .map((m) => m.fatigue1to10)
    .filter((f): f is number => f != null);
  const avgFatigue = fatigues.length
    ? +(fatigues.reduce((s, f) => s + f, 0) / fatigues.length).toFixed(1)
    : null;

  const flags: string[] = [];
  if (compliancePct < 60 && passed.length >= 3) flags.push("low_compliance");
  if (
    plannedLong &&
    plannedLong.date <= todayYmdStr &&
    plannedLong.status !== "completed"
  ) {
    flags.push("long_session_missing");
  }
  if (strengthWorkoutCount < plannedStrengthSessions - 1) {
    flags.push("strength_undershoot");
  }
  if (avgRpe != null && avgRpe >= 8.5) flags.push("high_average_rpe");
  if (extras >= 3) flags.push("many_extras");

  return {
    weekStart: ymd(weekStart(anchor)),
    weekNumber,
    phase: phase ? { number: phase.number, name: phase.name } : null,
    planned: {
      sessions: plannedSessions,
      strengthSessions: plannedStrengthSessions,
      totalMinutes: plannedTotalMin,
      longSessionMinutes: plannedLong?.targetDurationMinutes ?? null,
      longSessionPackLb: plannedLong?.targetPackWeightLb ?? null,
      longSessionElevationFt: plannedLong?.targetElevationGainFt ?? null,
    },
    actual: {
      sessions: workouts.length,
      strengthSessions: strengthWorkoutCount,
      totalMinutes: actualTotalMin,
      aerobicMinutes: aerobicMin,
      runningMinutes: runningMin,
      mountainMinutes: mountainMin,
      elevationGainM: Math.round(elevationM),
      longestSessionMinutes: longest || null,
      averageRpe: avgRpe,
      maxPackWeightKg: maxPack,
      extrasCount: extras,
    },
    compliance: {
      completed: completed.length,
      skipped: skipped.length,
      passed: passed.length,
      total: plannedSessions,
      percent: compliancePct,
    },
    weightTrend: {
      startKg: weights[0] ?? null,
      endKg: weights.at(-1) ?? null,
      deltaKg:
        weights.length >= 2
          ? +((weights.at(-1) as number) - weights[0]).toFixed(2)
          : null,
    },
    averageFatigue: avgFatigue,
    flags,
  };
}
