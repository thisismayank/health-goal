/**
 * Basecamp character sheet — 5 stats derived from recent-window training data.
 *
 * Freshness principle (2026-08-15): scores reflect the last 60–90 days only.
 * Historical peaks do NOT count; capabilities decay if not practiced.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  strengthExercise,
  trainingPlan,
  workout,
} from "@/db/schema";
import { hrvBaseline, rhrBaseline } from "@/lib/analytics/baselines";
import { ymd } from "@/lib/date";

export type StatKey = "STR" | "END" | "POW" | "REC" | "WILL";

export type Stat = {
  key: StatKey;
  label: string;
  value: number; // 0–100, calibrated against S-rank (Denali-ready) ceiling
  metric: string; // one-line human-readable "what actually drove this"
  windowDays: number; // freshness window used
  evidence: Record<string, number | string | null>; // machine-readable breakdown
};

export type CharacterSheet = {
  computedAt: Date;
  stats: Record<StatKey, Stat>;
};

const WINDOW_DAYS: Record<StatKey, number> = {
  STR: 90,
  END: 60,
  POW: 90,
  REC: 28,
  WILL: 30,
};

const RUNNING_CATS = ["EASY_RUN", "QUALITY_RUN"];
const AEROBIC_CATS = ["EASY_RUN", "QUALITY_RUN", "ZONE2_CARDIO"];
const MOUNTAIN_CATS = [
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
];

function shiftDate(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------- STR ----------
// S-rank target: ~15 heavy sets/wk + squat 1RM ~= 2x bodyweight (170 kg @ 85 kg)
async function computeStr(userId: number, now: Date): Promise<Stat> {
  const windowStart = shiftDate(now, -WINDOW_DAYS.STR);
  const fourWeeksAgo = shiftDate(now, -28);

  const rows = await db
    .select({
      startTime: workout.startTime,
      exerciseName: strengthExercise.exerciseName,
      reps: strengthExercise.reps,
      weightKg: strengthExercise.weightKg,
    })
    .from(strengthExercise)
    .innerJoin(workout, eq(strengthExercise.workoutId, workout.id))
    .where(and(eq(workout.userId, userId), gte(workout.startTime, windowStart)));

  const recentSets = rows.filter((r) => r.startTime >= fourWeeksAgo);
  const weeklyHardSets = recentSets.length / 4;

  const bestByExercise = new Map<string, number>();
  for (const r of rows) {
    if (r.reps == null || r.weightKg == null || r.weightKg <= 0) continue;
    const est1rm = r.weightKg * (1 + r.reps / 30);
    const cur = bestByExercise.get(r.exerciseName) ?? 0;
    if (est1rm > cur) bestByExercise.set(r.exerciseName, est1rm);
  }
  const squatMax = bestByExercise.get("Barbell squat") ?? 0;

  const setsScore = clamp((weeklyHardSets / 15) * 100);
  // Assume bodyweight target ~85 kg; scale to 2x = 170 kg
  const strengthScore = squatMax > 0 ? clamp((squatMax / 170) * 100) : 0;
  const value = Math.round(setsScore * 0.55 + strengthScore * 0.45);

  const metric =
    squatMax > 0
      ? `${weeklyHardSets.toFixed(1)} sets/wk · squat 1RM≈${Math.round(squatMax)} kg`
      : `${weeklyHardSets.toFixed(1)} sets/wk · squat 1RM not logged`;

  return {
    key: "STR",
    label: "Strength",
    value,
    metric,
    windowDays: WINDOW_DAYS.STR,
    evidence: {
      weeklyHardSets: +weeklyHardSets.toFixed(1),
      squatMaxKg: +squatMax.toFixed(1),
      exerciseCount: bestByExercise.size,
    },
  };
}

// ---------- END ----------
// S-rank target: ~450 min/week aerobic AND longest session 6+ hrs
async function computeEnd(userId: number, now: Date): Promise<Stat> {
  const windowStart = shiftDate(now, -WINDOW_DAYS.END);

  const rows = await db
    .select()
    .from(workout)
    .where(and(eq(workout.userId, userId), gte(workout.startTime, windowStart)));

  const aerobicMin = rows
    .filter((w) => AEROBIC_CATS.includes(w.type) || MOUNTAIN_CATS.includes(w.type))
    .reduce((s, w) => s + (w.durationSeconds ?? 0) / 60, 0);
  const weeklyAerobic = aerobicMin / (WINDOW_DAYS.END / 7);

  const longestMin = rows.reduce(
    (max, w) => Math.max(max, (w.durationSeconds ?? 0) / 60),
    0,
  );

  const volumeScore = clamp((weeklyAerobic / 450) * 100);
  const longestScore = clamp((longestMin / 360) * 100);
  const value = Math.round(volumeScore * 0.5 + longestScore * 0.5);

  return {
    key: "END",
    label: "Endurance",
    value,
    metric: `${Math.round(weeklyAerobic)} min/wk aerobic · longest ${Math.round(longestMin)} min`,
    windowDays: WINDOW_DAYS.END,
    evidence: {
      weeklyAerobicMin: Math.round(weeklyAerobic),
      longestSessionMin: Math.round(longestMin),
      sessionCount: rows.length,
    },
  };
}

// ---------- POW ----------
// S-rank target: 5000+ ft weekly vertical AND 40+ lb pack tolerance
async function computePow(userId: number, now: Date): Promise<Stat> {
  const windowStart = shiftDate(now, -WINDOW_DAYS.POW);

  const rows = await db
    .select()
    .from(workout)
    .where(and(eq(workout.userId, userId), gte(workout.startTime, windowStart)));

  const totalMeters = rows.reduce((s, w) => s + (w.elevationGainMeters ?? 0), 0);
  const totalFeet = totalMeters * 3.281;
  const weeklyFeet = totalFeet / (WINDOW_DAYS.POW / 7);

  const packKg = rows.reduce((max, w) => Math.max(max, w.packWeightKg ?? 0), 0);
  const packLb = packKg * 2.205;

  const vertScore = clamp((weeklyFeet / 5000) * 100);
  const packScore = clamp((packLb / 40) * 100);
  const value = Math.round(vertScore * 0.6 + packScore * 0.4);

  return {
    key: "POW",
    label: "Power",
    value,
    metric:
      packLb > 0
        ? `${Math.round(weeklyFeet)} ft/wk vertical · max pack ${Math.round(packLb)} lb`
        : `${Math.round(weeklyFeet)} ft/wk vertical · no pack logged`,
    windowDays: WINDOW_DAYS.POW,
    evidence: {
      totalFeetWindow: Math.round(totalFeet),
      weeklyFeet: Math.round(weeklyFeet),
      maxPackLb: Math.round(packLb),
    },
  };
}

// ---------- REC ----------
// Blends sleep vs 7h target + RHR/HRV vs personal baseline.
async function computeRec(userId: number, now: Date): Promise<Stat> {
  const windowStart = shiftDate(now, -WINDOW_DAYS.REC);

  const metrics = await db
    .select()
    .from(dailyMetric)
    .where(
      and(
        eq(dailyMetric.userId, userId),
        gte(dailyMetric.date, ymd(windowStart)),
      ),
    );

  const sleeps = metrics
    .map((m) => m.sleepMinutes)
    .filter((v): v is number => v != null);
  const avgSleepH = sleeps.length
    ? sleeps.reduce((s, v) => s + v, 0) / sleeps.length / 60
    : null;

  const rhr = await rhrBaseline(userId, ymd(now));
  const hrv = await hrvBaseline(userId, ymd(now));

  // Sleep score vs 7.5h target
  const sleepScore = avgSleepH != null ? clamp((avgSleepH / 7.5) * 100) : null;

  // RHR delta: 0 delta = 100; +10 above baseline = 0
  const rhrScore =
    rhr.deltaAbs != null ? clamp(100 - rhr.deltaAbs * 10) : null;

  // HRV delta: +0% = 100; -20% = 40; positive is even better (capped 100)
  const hrvScore =
    hrv.deltaPct != null ? clamp(100 + hrv.deltaPct * 3) : null;

  const components = [sleepScore, rhrScore, hrvScore].filter(
    (v): v is number => v != null,
  );
  const value =
    components.length === 0
      ? 60 // neutral when no recovery data yet
      : Math.round(components.reduce((s, v) => s + v, 0) / components.length);

  const bits: string[] = [];
  if (avgSleepH != null) bits.push(`sleep ${avgSleepH.toFixed(1)}h avg`);
  if (rhr.baseline != null && rhr.current != null)
    bits.push(
      `RHR ${rhr.current} (Δ${rhr.deltaAbs! > 0 ? "+" : ""}${rhr.deltaAbs})`,
    );
  if (hrv.baseline != null && hrv.current != null)
    bits.push(
      `HRV ${hrv.current} (Δ${hrv.deltaPct! > 0 ? "+" : ""}${hrv.deltaPct}%)`,
    );

  return {
    key: "REC",
    label: "Recovery",
    value,
    metric: bits.length > 0 ? bits.join(" · ") : "no recovery data yet",
    windowDays: WINDOW_DAYS.REC,
    evidence: {
      avgSleepH: avgSleepH != null ? +avgSleepH.toFixed(2) : null,
      rhrCurrent: rhr.current,
      rhrDelta: rhr.deltaAbs,
      hrvCurrent: hrv.current,
      hrvDelta: hrv.deltaPct,
    },
  };
}

// ---------- WILL ----------
// Compliance % over last 4 weeks + current streak.
async function computeWill(userId: number, now: Date): Promise<Stat> {
  const windowStart = shiftDate(now, -WINDOW_DAYS.WILL);
  const todayStr = ymd(now);

  const [plan] = await db
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.userId, userId), eq(trainingPlan.status, "active")))
    .limit(1);

  let compliancePct = 0;
  if (plan) {
    const sessions = await db
      .select()
      .from(plannedSession)
      .where(
        and(
          eq(plannedSession.planId, plan.id),
          gte(plannedSession.date, ymd(windowStart)),
        ),
      );
    const past = sessions.filter((s) => s.date <= todayStr);
    const completed = past.filter((s) => s.status === "completed").length;
    compliancePct = past.length === 0 ? 0 : (completed / past.length) * 100;
  }

  // Streak: consecutive days back from today where either a session was
  // completed OR the day was rest/active-recovery OR no session planned.
  const streakSessions = plan
    ? await db
        .select()
        .from(plannedSession)
        .where(eq(plannedSession.planId, plan.id))
        .orderBy(desc(plannedSession.date))
    : [];
  const byDate = new Map(streakSessions.map((s) => [s.date, s]));

  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = shiftDate(now, -i);
    const dStr = ymd(d);
    const s = byDate.get(dStr);
    if (!s) {
      // No planned session for this day — free pass (streak preserved)
      streak += 1;
      continue;
    }
    if (
      s.status === "completed" ||
      s.sessionCategory === "ACTIVE_RECOVERY" ||
      s.sessionCategory === "REST"
    ) {
      streak += 1;
      continue;
    }
    break;
  }

  const complianceScore = clamp(compliancePct);
  const streakScore = clamp((streak / 30) * 100);
  const value = Math.round(complianceScore * 0.65 + streakScore * 0.35);

  return {
    key: "WILL",
    label: "Discipline",
    value,
    metric: `${Math.round(compliancePct)}% 4-wk compliance · ${streak}-day streak`,
    windowDays: WINDOW_DAYS.WILL,
    evidence: {
      compliancePct: Math.round(compliancePct),
      streak,
    },
  };
}

export async function computeCharacterSheet(
  userId: number,
): Promise<CharacterSheet> {
  const now = new Date();
  const [STR, END, POW, REC, WILL] = await Promise.all([
    computeStr(userId, now),
    computeEnd(userId, now),
    computePow(userId, now),
    computeRec(userId, now),
    computeWill(userId, now),
  ]);
  return {
    computedAt: now,
    stats: { STR, END, POW, REC, WILL },
  };
}

export function currentStreakFromSheet(sheet: CharacterSheet): number {
  return (sheet.stats.WILL.evidence.streak as number) ?? 0;
}
