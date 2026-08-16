/**
 * Plan-wide progress rollup — cumulative-since-start view.
 *
 * Replaces the mid-week retrospective ("weekly snapshot") with a forward-
 * looking "how am I doing overall" view. Combines cumulative stats since
 * plan start with a rolling 4-week trajectory.
 */

import { addDays, differenceInCalendarWeeks } from "date-fns";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  trainingPlan,
  workout,
  type SessionCategory,
} from "@/db/schema";
import { hrvBaseline, rhrBaseline } from "@/lib/analytics/baselines";
import { ymd, parseYmd, weekStart } from "@/lib/date";
import { estimatedVerticalMeters, metersToFeet } from "@/lib/basecamp/summit";
import { phaseForWeek, TOTAL_SEEDED_WEEKS } from "@/lib/plan";

export type PlanWeekPoint = {
  weekStart: string;
  weekNumber: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  compliancePct: number;
  minutesActual: number;
  minutesPlanned: number;
  longestSessionMin: number;
  verticalFt: number;
  avgRpe: number | null;
};

export type PlanRollup = {
  planStartDate: string;
  currentWeek: number;
  totalWeeks: number;
  phase: { number: number; name: string };
  daysToSummit: number | null;

  cumulative: {
    weeksElapsed: number;
    sessionsPlanned: number;
    sessionsCompleted: number;
    sessionsSkipped: number;
    compliancePct: number;
    plannedMinutes: number;
    actualMinutes: number;
    totalVerticalFt: number;
    workoutsCount: number;
  };

  recentTrend: {
    last4Weeks: PlanWeekPoint[];
    trajectory: "improving" | "steady" | "declining" | "insufficient_data";
  };

  weight: {
    startingKg: number | null;
    currentAvgKg: number | null;
    deltaKg: number | null;
  };

  recovery: {
    sleepAvgHours30d: number | null;
    rhrBaseline: number | null;
    hrvBaseline: number | null;
  };

  flags: string[];
};

const AEROBIC_CATS: SessionCategory[] = [
  "EASY_RUN",
  "QUALITY_RUN",
  "ZONE2_CARDIO",
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
];

function trajectoryFrom(points: PlanWeekPoint[]): PlanRollup["recentTrend"]["trajectory"] {
  if (points.length < 3) return "insufficient_data";
  // Compare average of first half vs second half of the window
  const mid = Math.floor(points.length / 2);
  const earlier = points.slice(0, mid);
  const later = points.slice(mid);
  const avg = (ps: PlanWeekPoint[]) =>
    ps.reduce((s, p) => s + p.compliancePct, 0) / ps.length;
  const delta = avg(later) - avg(earlier);
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "steady";
}

export async function getPlanRollup(
  userId: number,
  todayYmd: string,
  summitDateYmd: string | null,
): Promise<PlanRollup | null> {
  const [plan] = await db
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.userId, userId), eq(trainingPlan.status, "active")))
    .limit(1);
  if (!plan) return null;

  const startDate = parseYmd(plan.startDate);
  const todayLocal = parseYmd(todayYmd);
  const weeksElapsedRaw = differenceInCalendarWeeks(todayLocal, startDate, {
    weekStartsOn: 1,
  });
  const currentWeek = weeksElapsedRaw + 1;
  const phase = phaseForWeek(currentWeek);
  const daysToSummit = summitDateYmd
    ? Math.max(
        0,
        Math.round(
          (parseYmd(summitDateYmd).getTime() - todayLocal.getTime()) /
            86_400_000,
        ),
      )
    : null;

  // ----- Cumulative -----
  const plannedSessions = await db
    .select()
    .from(plannedSession)
    .where(
      and(
        eq(plannedSession.planId, plan.id),
        lte(plannedSession.date, todayYmd),
      ),
    );
  const sessionsPlanned = plannedSessions.length;
  const sessionsCompleted = plannedSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const sessionsSkipped = plannedSessions.filter(
    (s) => s.status === "skipped",
  ).length;
  const compliancePct =
    sessionsPlanned === 0
      ? 0
      : Math.round((sessionsCompleted / sessionsPlanned) * 100);
  const plannedMinutes = plannedSessions.reduce(
    (s, p) => s + (p.targetDurationMinutes ?? 0),
    0,
  );

  const startTimestamp = startDate;
  const workouts = await db
    .select()
    .from(workout)
    .where(
      and(eq(workout.userId, userId), gte(workout.startTime, startTimestamp)),
    );
  const actualMinutes = workouts.reduce(
    (s, w) => s + Math.round((w.durationSeconds ?? 0) / 60),
    0,
  );
  const totalVerticalFt = workouts.reduce(
    (s, w) => s + metersToFeet(estimatedVerticalMeters(w).meters),
    0,
  );

  // ----- Recent 4-week trend -----
  const trendWeeks: PlanWeekPoint[] = [];
  for (let i = 3; i >= 0; i--) {
    const anchor = addDays(todayLocal, -7 * i);
    const ws = weekStart(anchor);
    const we = addDays(ws, 6);
    const wsYmd = ymd(ws);
    const weYmd = ymd(we);
    const weekNum = differenceInCalendarWeeks(ws, startDate, {
      weekStartsOn: 1,
    }) + 1;
    if (weekNum < 1) continue;

    const weekPlanned = plannedSessions.filter(
      (p) => p.date >= wsYmd && p.date <= weYmd,
    );
    const weekPlannedPassed = weekPlanned.filter((p) => p.date <= todayYmd);
    const weekCompleted = weekPlannedPassed.filter(
      (p) => p.status === "completed",
    ).length;

    const weekWorkouts = workouts.filter(
      (w) =>
        w.startTime >= ws &&
        w.startTime <= new Date(we.getTime() + 86_400_000 - 1),
    );

    const weekMinutes = weekWorkouts.reduce(
      (s, w) => s + Math.round((w.durationSeconds ?? 0) / 60),
      0,
    );
    const weekVertFt = weekWorkouts.reduce(
      (s, w) => s + metersToFeet(estimatedVerticalMeters(w).meters),
      0,
    );
    const longest = weekWorkouts.reduce(
      (m, w) => Math.max(m, Math.round((w.durationSeconds ?? 0) / 60)),
      0,
    );
    const rpes = weekWorkouts
      .map((w) => w.rpe)
      .filter((r): r is number => r != null);
    const avgRpe =
      rpes.length > 0
        ? +(rpes.reduce((s, r) => s + r, 0) / rpes.length).toFixed(1)
        : null;
    const complianceWeek =
      weekPlannedPassed.length === 0
        ? 0
        : Math.round((weekCompleted / weekPlannedPassed.length) * 100);

    trendWeeks.push({
      weekStart: wsYmd,
      weekNumber: weekNum,
      sessionsCompleted: weekCompleted,
      sessionsPlanned: weekPlannedPassed.length,
      compliancePct: complianceWeek,
      minutesActual: weekMinutes,
      minutesPlanned: weekPlanned.reduce(
        (s, p) => s + (p.targetDurationMinutes ?? 0),
        0,
      ),
      longestSessionMin: longest,
      verticalFt: weekVertFt,
      avgRpe,
    });
  }
  const trajectory = trajectoryFrom(trendWeeks);

  // ----- Weight -----
  const weightMetrics = await db
    .select()
    .from(dailyMetric)
    .where(
      and(
        eq(dailyMetric.userId, userId),
        gte(dailyMetric.date, plan.startDate),
        lte(dailyMetric.date, todayYmd),
      ),
    )
    .orderBy(dailyMetric.date);
  const weights = weightMetrics
    .map((m) => m.bodyWeightKg)
    .filter((w): w is number => w != null);
  const startingKg = weights.length > 0 ? +weights[0].toFixed(2) : null;
  // 7-day rolling avg for current
  const last7 = weights.slice(-7);
  const currentAvgKg =
    last7.length > 0
      ? +(last7.reduce((s, v) => s + v, 0) / last7.length).toFixed(2)
      : null;
  const deltaKg =
    startingKg != null && currentAvgKg != null
      ? +(currentAvgKg - startingKg).toFixed(2)
      : null;

  // ----- Recovery baselines -----
  const rhr = await rhrBaseline(userId, todayYmd);
  const hrv = await hrvBaseline(userId, todayYmd);
  const sleep30d = weightMetrics
    .slice(-30)
    .map((m) => m.sleepMinutes)
    .filter((v): v is number => v != null);
  const sleepAvgHours30d =
    sleep30d.length > 0
      ? +(sleep30d.reduce((s, v) => s + v, 0) / sleep30d.length / 60).toFixed(2)
      : null;

  // ----- Flags -----
  const flags: string[] = [];
  if (compliancePct < 60 && sessionsPlanned >= 3) flags.push("low_overall_compliance");
  if (trajectory === "declining") flags.push("compliance_declining");
  const lastTwoWeeks = trendWeeks.slice(-2);
  if (lastTwoWeeks.length === 2 && lastTwoWeeks.every((w) => w.longestSessionMin < 45))
    flags.push("no_long_sessions_recent");
  if (rhr.deltaAbs != null && rhr.deltaAbs >= 8) flags.push("rhr_elevated");
  if (sleepAvgHours30d != null && sleepAvgHours30d < 6.5)
    flags.push("sleep_deficit_30d");

  return {
    planStartDate: plan.startDate,
    currentWeek,
    totalWeeks: TOTAL_SEEDED_WEEKS,
    phase: { number: phase.number, name: phase.name },
    daysToSummit,
    cumulative: {
      weeksElapsed: Math.max(0, weeksElapsedRaw),
      sessionsPlanned,
      sessionsCompleted,
      sessionsSkipped,
      compliancePct,
      plannedMinutes,
      actualMinutes,
      totalVerticalFt,
      workoutsCount: workouts.length,
    },
    recentTrend: {
      last4Weeks: trendWeeks,
      trajectory,
    },
    weight: {
      startingKg,
      currentAvgKg,
      deltaKg,
    },
    recovery: {
      sleepAvgHours30d,
      rhrBaseline: rhr.baseline,
      hrvBaseline: hrv.baseline,
    },
    flags,
  };
}
