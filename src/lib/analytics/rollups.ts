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
import {
  nowInTimeZone,
  parseYmd,
  todayInTimeZone,
  weekDays,
  weekStart,
  ymd,
  ymdInTimeZone,
} from "@/lib/date";
import {
  phaseForWeek,
  sessionCompletionQualifies,
  type Phase,
} from "@/lib/plan";
import {
  hrvBaseline,
  rhrBaseline,
  sleepBaseline,
  type Baseline,
} from "./baselines";

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
  context: {
    isCurrentDay: boolean;
    localWallTime: string;
    hourOfDay: number;
    // Loose bucket: morning (<12), afternoon (12-17), evening (17-21), late (21+)
    partOfDay: "morning" | "afternoon" | "evening" | "late";
  };
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
  recovery: {
    sleepMinutes: number | null;
    sleepBaselineMinutes: number | null;
    restingHr: Baseline;
    hrv: Baseline;
    steps: number | null;
    activeEnergyKcal: number | null;
    sleepScore: number | null;
    readiness: number | null;
    stressScore: number | null;
    vo2Max: number | null;
    spo2Pct: number | null;
    respirationRpm: number | null;
    avgSleepingHrBpm: number | null;
    bodyFatPct: number | null;
    trainingLoad: {
      ctl: number | null;
      atl: number | null;
      tsb: number | null;
      interpretation:
        | "fresh"
        | "steady"
        | "fatigued"
        | "very_fatigued"
        | "unknown";
    };
    hasAnySignal: boolean;
    concernFlags: string[];
  };
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

function partOfDay(hour: number): DailyRollup["context"]["partOfDay"] {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "late";
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

  const now = nowInTimeZone(tz);
  const isCurrentDay = dateYmd === todayInTimeZone(tz);

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

  const rhr = await rhrBaseline(userId, dateYmd);
  const hrv = await hrvBaseline(userId, dateYmd);
  const sleep = await sleepBaseline(userId, dateYmd);
  const sleepMinutes = metric?.sleepMinutes ?? null;

  const concernFlags: string[] = [];
  if (rhr.deltaAbs != null && rhr.deltaAbs >= 8) concernFlags.push("rhr_high");
  if (hrv.deltaPct != null && hrv.deltaPct <= -15) concernFlags.push("hrv_low");
  if (sleepMinutes != null && sleepMinutes < 5.5 * 60) concernFlags.push("sleep_short");

  const ctl = metric?.ctl ?? null;
  const atl = metric?.atl ?? null;
  const tsb = ctl != null && atl != null ? +(ctl - atl).toFixed(1) : null;
  const tsbInterpretation: DailyRollup["recovery"]["trainingLoad"]["interpretation"] =
    tsb == null
      ? "unknown"
      : tsb <= -20
        ? "very_fatigued"
        : tsb <= -10
          ? "fatigued"
          : tsb < 5
            ? "steady"
            : "fresh";

  const hasAnySignal =
    sleepMinutes != null ||
    rhr.current != null ||
    hrv.current != null ||
    (metric?.steps ?? null) != null ||
    (metric?.sleepScore ?? null) != null ||
    (metric?.readiness ?? null) != null ||
    ctl != null ||
    atl != null;

  return {
    date: dateYmd,
    weekday,
    weekNumber,
    phase: phase ? { number: phase.number, name: phase.name } : null,
    context: {
      isCurrentDay,
      localWallTime: now.wallClock,
      hourOfDay: now.hour,
      partOfDay: partOfDay(now.hour),
    },
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
    recovery: {
      sleepMinutes,
      sleepBaselineMinutes: sleep.baseline,
      restingHr: rhr,
      hrv,
      steps: metric?.steps ?? null,
      activeEnergyKcal: metric?.activeEnergyKcal ?? null,
      sleepScore: metric?.sleepScore ?? null,
      readiness: metric?.readiness ?? null,
      stressScore: metric?.stressScore ?? null,
      vo2Max: metric?.vo2Max ?? null,
      spo2Pct: metric?.spo2Pct ?? null,
      respirationRpm: metric?.respirationRpm ?? null,
      avgSleepingHrBpm: metric?.avgSleepingHrBpm ?? null,
      bodyFatPct: metric?.bodyFatPct ?? null,
      trainingLoad: {
        ctl,
        atl,
        tsb,
        interpretation: tsbInterpretation,
      },
      hasAnySignal,
      concernFlags,
    },
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
  context: {
    isCurrentWeek: boolean;
    dayIndexInWeek: number; // 1..7 (Mon=1, Sun=7). Reflects how far through we are.
    daysElapsed: number; // number of days that have fully or partially happened (>=1)
    daysRemaining: number; // days strictly after today in this week
    plannedRemaining: number; // planned sessions on future dates in this week
    remainingSessions: Array<{
      date: string;
      weekday: string;
      title: string;
      category: SessionCategory;
      targetDurationMinutes: number | null;
    }>;
  };
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
  recovery: {
    sleepAvgHours: number | null;
    hrvAvgMs: number | null;
    restingHrAvgBpm: number | null;
    stepsAvg: number | null;
    daysWithSignal: number;
  };
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
  const isCurrentWeek = todayYmdStr >= startYmd && todayYmdStr <= endYmd;
  const dayIndexInWeek = isCurrentWeek
    ? days.findIndex((d) => ymd(d) === todayYmdStr) + 1
    : 8; // sentinel: full week considered elapsed for past weeks

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

  const sleepMins = metrics.map((m) => m.sleepMinutes).filter((v): v is number => v != null);
  const hrvs = metrics.map((m) => m.hrvMs).filter((v): v is number => v != null);
  const rhrs = metrics.map((m) => m.restingHrBpm).filter((v): v is number => v != null);
  const stepsList = metrics.map((m) => m.steps).filter((v): v is number => v != null);
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const sleepAvgHours = sleepMins.length ? +(avg(sleepMins)! / 60).toFixed(2) : null;
  const hrvAvgMs = hrvs.length ? +avg(hrvs)!.toFixed(1) : null;
  const restingHrAvgBpm = rhrs.length ? Math.round(avg(rhrs)!) : null;
  const stepsAvg = stepsList.length ? Math.round(avg(stepsList)!) : null;
  const daysWithSignal = metrics.filter(
    (m) =>
      m.sleepMinutes != null ||
      m.hrvMs != null ||
      m.restingHrBpm != null ||
      m.steps != null,
  ).length;

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

  const remainingSessions = plannedRows
    .filter((p) => p.date > todayYmdStr)
    .map((p) => {
      const d = parseYmd(p.date);
      const weekday = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: tz,
      }).format(d);
      return {
        date: p.date,
        weekday,
        title: p.title,
        category: p.sessionCategory,
        targetDurationMinutes: p.targetDurationMinutes,
      };
    });

  return {
    weekStart: ymd(weekStart(anchor)),
    weekNumber,
    phase: phase ? { number: phase.number, name: phase.name } : null,
    context: {
      isCurrentWeek,
      dayIndexInWeek: Math.min(dayIndexInWeek, 7),
      daysElapsed: isCurrentWeek ? dayIndexInWeek : 7,
      daysRemaining: isCurrentWeek ? Math.max(0, 7 - dayIndexInWeek) : 0,
      plannedRemaining: remainingSessions.length,
      remainingSessions,
    },
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
    recovery: {
      sleepAvgHours,
      hrvAvgMs,
      restingHrAvgBpm,
      stepsAvg,
      daysWithSignal,
    },
    flags,
  };
}
