/**
 * Trail Readiness engine.
 *
 * Given: a specific trail (distance, vertical, altitude, pack, typical hours)
 * plus optional target date, and the user's recent fitness (with freshness
 * decay — no lifetime peaks).
 *
 * Returns: a deterministic assessment (dimensions + verdict + suggested
 * adjustments) that the LLM can then narrate.
 */

import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric, workout, type Trail } from "@/db/schema";
import {
  hrvBaseline,
  rhrBaseline,
  sleepBaseline,
  type Baseline,
} from "@/lib/analytics/baselines";
import { ymd } from "@/lib/date";
import { estimatedVerticalMeters, metersToFeet } from "./summit";

// -------- Fitness snapshot --------

export type FitnessSnapshot = {
  longestRecentSessionMin: number;
  weeklyAerobicMinutes: number;
  maxSingleSessionVertFt: number;
  cumulative90dVertFt: number;
  maxPackLb: number;
  maxAltitudeReachedFt: number | null; // from prior assessed trails; null if unknown
  rhr: Baseline;
  hrv: Baseline;
  sleepAvgHours: number | null;
  vo2Max: number | null;
};

const AEROBIC_CATS = [
  "EASY_RUN",
  "QUALITY_RUN",
  "ZONE2_CARDIO",
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
];

export async function loadFitnessSnapshot(
  userId: number,
  opts?: { excludeWorkoutIds?: number[] },
): Promise<FitnessSnapshot> {
  const now = new Date();
  // Longest session: 60-day window (freshness — capabilities decay after 8 wks off).
  // Weekly aerobic: 28-day window (4-wk rolling avg — reflects CURRENT training rate,
  // not diluted by weeks you weren't using the app).
  // Vertical/pack: 90-day window (slower decay).
  const windowStart28 = new Date(now.getTime() - 28 * 86_400_000);
  const windowStart60 = new Date(now.getTime() - 60 * 86_400_000);
  const windowStart90 = new Date(now.getTime() - 90 * 86_400_000);

  const excludes = opts?.excludeWorkoutIds ?? [];
  const applyExcl = (base: ReturnType<typeof and>) =>
    excludes.length > 0
      ? and(base, notInArray(workout.id, excludes))
      : base;

  const [workouts28, workouts60, workouts90] = await Promise.all([
    db
      .select()
      .from(workout)
      .where(
        applyExcl(
          and(eq(workout.userId, userId), gte(workout.startTime, windowStart28)),
        ),
      ),
    db
      .select()
      .from(workout)
      .where(
        applyExcl(
          and(eq(workout.userId, userId), gte(workout.startTime, windowStart60)),
        ),
      ),
    db
      .select()
      .from(workout)
      .where(
        applyExcl(
          and(eq(workout.userId, userId), gte(workout.startTime, windowStart90)),
        ),
      ),
  ]);

  const longestRecentMin = Math.round(
    workouts60.reduce(
      (max, w) => Math.max(max, (w.durationSeconds ?? 0) / 60),
      0,
    ),
  );

  const aerobicMin28 = workouts28
    .filter((w) => AEROBIC_CATS.includes(w.type))
    .reduce((s, w) => s + (w.durationSeconds ?? 0) / 60, 0);
  const weeklyAerobic = Math.round(aerobicMin28 / 4);

  const perWorkoutVertFt = workouts90.map((w) =>
    metersToFeet(estimatedVerticalMeters(w).meters),
  );
  const maxSingleSessionVertFt = perWorkoutVertFt.reduce(
    (m, v) => Math.max(m, v),
    0,
  );
  const cumulative90dVertFt = perWorkoutVertFt.reduce((s, v) => s + v, 0);

  const maxPackKg = workouts90.reduce(
    (max, w) => Math.max(max, w.packWeightKg ?? 0),
    0,
  );
  const maxPackLb = +(maxPackKg * 2.205).toFixed(1);

  const today = ymd(now);
  const [rhr, hrv, sleep] = await Promise.all([
    rhrBaseline(userId, today),
    hrvBaseline(userId, today),
    sleepBaseline(userId, today),
  ]);

  const vo2Rows = await db
    .select()
    .from(dailyMetric)
    .where(eq(dailyMetric.userId, userId))
    .orderBy(desc(dailyMetric.date))
    .limit(60);
  const vo2Max = vo2Rows.find((r) => r.vo2Max != null)?.vo2Max ?? null;

  return {
    longestRecentSessionMin: longestRecentMin,
    weeklyAerobicMinutes: weeklyAerobic,
    maxSingleSessionVertFt,
    cumulative90dVertFt,
    maxPackLb,
    maxAltitudeReachedFt: null,
    rhr,
    hrv,
    sleepAvgHours: sleep.baseline != null ? +(sleep.baseline / 60).toFixed(1) : null,
    vo2Max,
  };
}

// -------- Assessment --------

export type DimensionStatus =
  | "ready" // current capacity already meets/exceeds trail demand
  | "closable" // gap is reachable within days available
  | "stretch" // gap is reachable but tight — expect struggle
  | "not_in_timeframe" // gap can't reasonably be closed
  | "concern" // recovery/altitude flags
  | "unknown" // signal missing — don't declare this dim ready OR blocking
  | "not_applicable";

export type DimensionAnalysis = {
  key: "endurance" | "vertical" | "pack" | "altitude" | "recovery";
  label: string;
  status: DimensionStatus;
  ratio: number; // 0-1 current-to-required (or interpreted per dimension)
  current: string; // human-readable
  required: string;
  note: string;
};

export type Verdict =
  | "comfortable"
  | "achievable"
  | "hard"
  | "do_not_attempt";

export type TrailAssessment = {
  verdict: Verdict;
  daysUntilTrail: number | null;
  weeksAvailable: number | null; // null if no target date
  // Rough number of weeks at current growth rate to close the largest
  // remaining gap. null when already ready OR when the gap is
  // effectively uncloseable (would need >52 weeks). Used as the
  // headline output on trail detail so users get a specific horizon
  // instead of a binary reassurance.
  weeksToReady: number | null;
  dimensions: DimensionAnalysis[];
  suggestedAdjustments: string[];
  fitnessSnapshot: FitnessSnapshot;
};

const WEEKLY_ENDURANCE_GROWTH = 0.1;
const WEEKLY_VERTICAL_GROWTH = 0.15;
const PACK_GROWTH_LB_PER_WEEK = 2;

function daysBetween(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

// Given a current capacity + weekly growth rate + weeks available, what
// capacity could realistically be reached by the target date?
function projectedCapacity(
  current: number,
  weeksAvailable: number,
  weeklyGrowthPct: number,
): number {
  const w = Math.max(0, weeksAvailable);
  return current * (1 + weeklyGrowthPct * w);
}

// Classify the endurance profile of a trail. typicalHours in the library
// represents the LONGEST single day for multi-day objectives (Kilimanjaro
// summit day, Aconcagua summit push, etc.), so we don't need multi-day math
// — but the athlete's prep target differs: single-day peak effort vs.
// sustained weekly volume for back-to-back trek days.
type TrailKind = "day_hike" | "long_day" | "summit_push" | "multi_day";

function classifyTrail(trail: Trail): TrailKind {
  const notesLower = (trail.notes ?? "").toLowerCase();
  const isMultiDay =
    /\b(day trek|day expedition|thru-?hike|circumnavigation|expedition)\b/.test(
      notesLower,
    ) || /(6|7|8|9|10|11|12|13|14|15|18|20|21|24)[- ]day/.test(notesLower);
  if (isMultiDay) return "multi_day";
  if (trail.typicalHours >= 10) return "summit_push";
  if (trail.typicalHours >= 5) return "long_day";
  return "day_hike";
}

// Per-kind readiness targets (before terrain strictness):
// - longestPct: your longest recent session should reach this % of trail's
//   typicalHours
// - weeklyMult: weekly aerobic base should reach this multiple of trail
//   duration (in minutes)
const ENDURANCE_RULE: Record<TrailKind, { longestPct: number; weeklyMult: number; label: string }> = {
  day_hike:    { longestPct: 0.40, weeklyMult: 0.75, label: "day hike" },
  long_day:    { longestPct: 0.35, weeklyMult: 1.00, label: "long day" },
  summit_push: { longestPct: 0.30, weeklyMult: 1.20, label: "summit push" },
  multi_day:   { longestPct: 0.30, weeklyMult: 1.50, label: "multi-day trek" },
};

function analyzeEndurance(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  hasDate: boolean,
): DimensionAnalysis {
  const neededMin = trail.typicalHours * 60;
  const longest = snap.longestRecentSessionMin;
  const weekly = snap.weeklyAerobicMinutes;

  const kind = classifyTrail(trail);
  const rule = ENDURANCE_RULE[kind];

  // Terrain strictness layers on top: technical/mountaineering demands
  // more, easy terrain forgives.
  const strictness =
    trail.terrainGrade === "mountaineering"
      ? 1.15
      : trail.terrainGrade === "technical"
        ? 1.1
        : trail.terrainGrade === "easy"
          ? 0.85
          : 1.0;

  const longestReadyMin = neededMin * rule.longestPct * strictness;
  const longestSoloReadyMin = longestReadyMin * 1.3; // ~30% higher solo bar
  const weeklyReadyMin = neededMin * rule.weeklyMult * strictness;
  const longestClosableMin = longestReadyMin * 0.6;
  const weeklyClosableMin = weeklyReadyMin * 0.7;

  // Projected fitness given time to build (used only when hasDate is true
  // and there's meaningful time — otherwise projections should not carry
  // the "closable" verdict)
  const projLongest = projectedCapacity(
    Math.max(longest, 15),
    weeksAvail,
    WEEKLY_ENDURANCE_GROWTH,
  );
  const projWeekly = projectedCapacity(
    Math.max(weekly, 30),
    weeksAvail,
    WEEKLY_ENDURANCE_GROWTH,
  );

  const readyByCombined =
    longest >= longestReadyMin && weekly >= weeklyReadyMin;
  const readyBySolo = longest >= longestSoloReadyMin;
  const closableByProjection =
    (projLongest >= longestReadyMin && projWeekly >= weeklyReadyMin) ||
    projLongest >= longestSoloReadyMin;
  const stretchByProjection =
    projLongest >= longestClosableMin || projWeekly >= weeklyClosableMin;

  let status: DimensionStatus;
  if (readyByCombined || readyBySolo) status = "ready";
  else if (closableByProjection) status = "closable";
  else if (stretchByProjection) status = "stretch";
  else status = "not_in_timeframe";

  // Ratio for the progress bar: blend longest-vs-target + weekly-vs-target
  const longestRatio = longest / Math.max(1, longestReadyMin);
  const weeklyRatio = weekly / Math.max(1, weeklyReadyMin);
  const combinedRatio = Math.min(1, (longestRatio + weeklyRatio) / 2);

  const kindContext =
    kind === "multi_day"
      ? "This is a multi-day objective — sustained weekly volume matters more than any single long session; typicalHours here is the longest single day."
      : kind === "summit_push"
        ? "This is a summit push — a big single-day effort with alpine start. Aerobic base + mental resilience carry you through."
        : kind === "long_day"
          ? "This is a long single-day effort — break-friendly, base fitness carries you."
          : "This is a shorter day hike — continuous effort but manageable duration.";

  const noteReady =
    `Longest recent session (${longest} min) covers ~${Math.round((longest / neededMin) * 100)}% of trail duration; weekly aerobic base is ${weekly} min/week (4-wk avg). Base fitness supports the ${rule.label} profile.`;
  const noteClosable =
    `Current: longest ${longest} min, weekly aerobic ${weekly} min/week (4-wk avg). Target for a ${rule.label}: longest ~${Math.round(longestReadyMin)} min + weekly ~${Math.round(weeklyReadyMin)} min. ` +
    (hasDate
      ? `Buildable in ${weeksAvail.toFixed(1)} weeks.`
      : "Buildable with a focused block.");
  const noteStretch =
    `Longest ${longest} min + weekly ${weekly} min/week (4-wk avg) are both below the ${rule.label} target (~${Math.round(longestReadyMin)} min longest, ~${Math.round(weeklyReadyMin)} min/week). ` +
    (hasDate
      ? `${weeksAvail.toFixed(1)} weeks is tight — expect real fatigue.`
      : "Expect fatigue without a proper build.");
  const noteGap =
    `Aerobic gap is large for a ${rule.label}: longest ${longest} min and weekly ${weekly} min/week are well below the ~${Math.round(longestReadyMin)} min / ~${Math.round(weeklyReadyMin)} min-per-week base needed.` +
    (hasDate
      ? " Time available not enough to close it."
      : " Requires a substantial training block.");

  const notes: Record<DimensionStatus, string> = {
    ready: `${kindContext} ${noteReady}`,
    closable: `${kindContext} ${noteClosable}`,
    stretch: `${kindContext} ${noteStretch}`,
    not_in_timeframe: `${kindContext} ${noteGap}`,
    concern: `${kindContext} ${noteReady}`,
    unknown: `${kindContext} Not enough recent training data to judge.`,
    not_applicable: `${kindContext} ${noteReady}`,
  };

  return {
    key: "endurance",
    label: "Endurance",
    status,
    ratio: combinedRatio,
    current: `${longest} min longest · ${weekly} min/week (4-wk avg)`,
    required: `~${Math.round(longestReadyMin)} min longest · ~${Math.round(weeklyReadyMin)} min/week`,
    note: notes[status],
  };
}

function analyzeVertical(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  _hasDate: boolean,
  kind: TrailKind,
): DimensionAnalysis {
  const totalNeeded = trail.elevationGainFt;
  const cur = snap.maxSingleSessionVertFt;

  // For multi-day objectives, elevationGainFt is TOTAL cumulative across
  // all days. Summit day is typically 25-35% of total. For summit-push
  // single-day objectives, the whole gain is in one day but often split
  // approach + summit. Adjust the threshold accordingly.
  const readyPct =
    kind === "day_hike"
      ? 0.6
      : kind === "long_day"
        ? 0.5
        : kind === "summit_push"
          ? 0.4
          : /* multi_day */ 0.25;

  // Effective per-day peak the user should have hit
  const effectiveTarget = Math.round(totalNeeded * readyPct);

  const projected = projectedCapacity(
    Math.max(cur, 100),
    weeksAvail,
    WEEKLY_VERTICAL_GROWTH,
  );
  const ratio = cur / Math.max(1, effectiveTarget);
  const projRatio = projected / Math.max(1, effectiveTarget);

  let status: DimensionStatus;
  if (ratio >= 1) status = "ready";
  else if (projRatio >= 1) status = "closable";
  else if (projRatio >= 0.6) status = "stretch";
  else status = "not_in_timeframe";

  const kindNote =
    kind === "multi_day"
      ? `Multi-day objectives spread vertical across days — target is a single-day peak of ~${effectiveTarget.toLocaleString()} ft (the biggest day, usually summit).`
      : kind === "summit_push"
        ? `Summit pushes are done in one day but often split approach + summit — target a single-day peak of ~${effectiveTarget.toLocaleString()} ft.`
        : `Target a single-day peak of ~${effectiveTarget.toLocaleString()} ft (${Math.round(readyPct * 100)}% of trail total).`;

  return {
    key: "vertical",
    label: "Vertical",
    status,
    ratio: Math.min(1, ratio),
    current: `${cur.toLocaleString()} ft (best recent session)`,
    required: `~${effectiveTarget.toLocaleString()} ft single-day peak · ${totalNeeded.toLocaleString()} ft total`,
    note:
      status === "ready"
        ? `${kindNote} Your recent range covers it.`
        : status === "closable"
          ? `${kindNote} Add stair or incline sessions to build toward it.`
          : status === "stretch"
            ? `${kindNote} Real vertical work needed; pace yourself on the day.`
            : `${kindNote} Vertical gap too large — consider a shorter alternative or a lower-elevation warmup objective first.`,
  };
}

function analyzePack(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  _hasDate: boolean,
  kind: TrailKind,
): DimensionAnalysis {
  const needed = trail.packWeightLb;
  const cur = snap.maxPackLb;

  if (needed <= 0) {
    return {
      key: "pack",
      label: "Pack",
      status: "not_applicable",
      ratio: 1,
      current: "n/a",
      required: "no pack",
      note: "Day-pack essentials only.",
    };
  }

  // For day hikes, pack is a light day pack — full match matters.
  // Day-hike short-circuit: a light day pack (≤10 lb — water bottle,
  // snacks, a jacket) requires no benchmark training. Anyone reasonably
  // mobile can carry that. Skip the ratio math and mark ready so we
  // don't wrongly flag people who've never logged a "pack workout".
  if (kind === "day_hike" && needed <= 10) {
    return {
      key: "pack",
      label: "Pack",
      status: "ready",
      ratio: 1,
      current: cur > 0 ? `${cur} lb (recent max)` : "no pack logged",
      required: `${needed} lb`,
      note: "Day pack — water, snacks, a light layer. Trivial load for most people, no prep required.",
    };
  }

  // Zero-baseline guard: if the user has literally never logged a pack
  // AND the trail wants a meaningful load (>15 lb), don't project a
  // fake growth curve. Zero → 24 lb "closable" over 12 weeks is a lie
  // — the projection assumes progressive loading that hasn't started.
  // Force this into 'stretch' at minimum, 'not_in_timeframe' if the
  // gap is large. This is what caught Wonderland showing pack=closable
  // at ratio=0.00.
  if (cur === 0 && needed > 15) {
    const status: DimensionStatus =
      needed >= 30 ? "not_in_timeframe" : "stretch";
    return {
      key: "pack",
      label: "Pack",
      status,
      ratio: 0,
      current: "no pack logged",
      required: `${needed} lb`,
      note:
        status === "not_in_timeframe"
          ? `${needed} lb pack with zero loading history — you'd need weeks of progressive loaded hikes before you're ready. Start now, or reduce pack weight.`
          : `${needed} lb pack is a real load. You've never logged carrying weight — expect the pack to be the limiting factor, not the trail.`,
    };
  }

  // For multi-day treks, pack weight is often smaller (porters carry the
  // bulk on Kili/EBC) or spread across days. Slightly relaxed.
  // For summit pushes / expeditions, the number IS what you carry.
  const readyPct =
    kind === "day_hike"
      ? 0.8
      : kind === "long_day"
        ? 0.8
        : kind === "summit_push"
          ? 0.7
          : /* multi_day */ 0.65;

  const projected = cur + PACK_GROWTH_LB_PER_WEEK * Math.max(0, weeksAvail);
  const ratio = cur / Math.max(0.01, needed);
  const projRatio = projected / needed;

  let status: DimensionStatus;
  if (ratio >= readyPct) status = "ready";
  else if (projRatio >= readyPct) status = "closable";
  else if (projRatio >= readyPct * 0.6) status = "stretch";
  else status = "not_in_timeframe";

  const kindNote =
    kind === "multi_day"
      ? "Multi-day: pack matters for sustained carry, though many treks (Kili/EBC) use porters."
      : kind === "summit_push"
        ? "Summit push: this is what you carry on the day, no porters."
        : "Day pack — water, layers, food.";

  return {
    key: "pack",
    label: "Pack",
    status,
    ratio: Math.min(1, ratio),
    current: cur > 0 ? `${cur} lb (recent max)` : "no pack logged",
    required: `${needed} lb`,
    note:
      status === "ready"
        ? `${kindNote} You've handled this recently.`
        : status === "closable"
          ? `${kindNote} Progressive loaded hikes: +${PACK_GROWTH_LB_PER_WEEK} lb/wk to reach ${needed} lb.`
          : status === "stretch"
            ? `${kindNote} Pack tolerance thin — consider going lighter on the day.`
            : `${kindNote} Pack weight ambitious given your recent loading. Reduce or postpone.`,
  };
}

function analyzeAltitude(
  trail: Trail,
  snap: FitnessSnapshot,
  kind: TrailKind,
): DimensionAnalysis {
  const alt = trail.maxAltitudeFt;
  const known = snap.maxAltitudeReachedFt;

  // Multi-day treks bake acclimatization into the itinerary (climb high,
  // sleep low over N days). A day hike or summit push to the same altitude
  // hits you much harder — thin air with no time to adapt.
  const acclimatizationBuffer = kind === "multi_day" ? 3000 : 0;
  const effectiveAlt = alt - acclimatizationBuffer;

  let status: DimensionStatus;
  let note: string;
  const modeNote =
    kind === "multi_day"
      ? "Multi-day acclimatization built into the trek (climb high, sleep low over days) — altitude tolerance is dramatically better than a single-day push to the same height. "
      : "";

  if (effectiveAlt < 6000) {
    status = "ready";
    note = `${modeNote}Sub-alpine altitude — no acclimatization concern.`;
  } else if (effectiveAlt < 8000) {
    status = "ready";
    note = `${modeNote}Mild elevation — most sea-level residents handle this fine.`;
  } else if (effectiveAlt < 10000) {
    status = "stretch";
    note = `${modeNote}Effective ~8–10k ft — sea-level residents may feel it (headache, shortness of breath). Pace conservatively.`;
  } else if (effectiveAlt < 12000) {
    status = "concern";
    note = `${modeNote}Effective ~10–12k ft — real altitude. Prior acclimatization within the last 60 days helps; going direct from sea level is uncomfortable.`;
  } else if (effectiveAlt < 14000) {
    status = "concern";
    note = `${modeNote}Effective ~12–14k ft — significant thin air. Sleep the night before at moderate altitude if possible.`;
  } else {
    status = "not_in_timeframe";
    note = `${modeNote}Effective above 14k ft — needs proper acclimatization protocol (multiple days at intermediate altitudes) before attempting.`;
  }

  return {
    key: "altitude",
    label: "Altitude",
    status,
    ratio:
      effectiveAlt < 8000
        ? 1
        : effectiveAlt < 10000
          ? 0.7
          : effectiveAlt < 12000
            ? 0.5
            : 0.3,
    current:
      known != null
        ? `last high point: ${known.toLocaleString()} ft`
        : "no altitude history",
    required: `${alt.toLocaleString()} ft${kind === "multi_day" ? ` (effective ~${effectiveAlt.toLocaleString()} ft with acclimatization)` : ""}`,
    note,
  };
}

function analyzeRecovery(
  snap: FitnessSnapshot,
  kind: TrailKind,
): DimensionAnalysis {
  const rhrDelta = snap.rhr.deltaAbs;
  const hrvDelta = snap.hrv.deltaPct;
  const sleep = snap.sleepAvgHours;

  // Multi-day objectives are stricter on recovery — you don't get a full
  // recovery night at home to bounce back if you go in already fatigued.
  const strict = kind === "multi_day";
  const rhrThreshold = strict ? 6 : 8;
  const hrvThreshold = strict ? -10 : -15;
  const sleepThreshold = strict ? 7.0 : 6.5;

  const signalCount =
    (rhrDelta != null ? 1 : 0) +
    (hrvDelta != null ? 1 : 0) +
    (sleep != null ? 1 : 0);

  const flags: string[] = [];
  if (rhrDelta != null && rhrDelta >= rhrThreshold)
    flags.push(`RHR +${rhrDelta} bpm`);
  if (hrvDelta != null && hrvDelta <= hrvThreshold)
    flags.push(`HRV ${hrvDelta}%`);
  if (sleep != null && sleep < sleepThreshold) flags.push(`sleep ${sleep}h avg`);

  const modePrefix = strict ? "Multi-day objectives set a stricter recovery bar — you don't get to recover at home mid-trek. " : "";

  let status: DimensionStatus;
  let note: string;
  // No recovery signals → UNKNOWN, not "ready". Old code silently
  // reported "Recovery baselines within normal range." for users with
  // no Oura/HealthKit connected — a lie that leaked into the verdict
  // and the ObjectiveCard's weakest-dim picker.
  if (signalCount < 2) {
    status = "unknown";
    note = signalCount === 0
      ? "No recovery data yet — connect Oura / HealthKit for a real read."
      : "Only one recovery signal available. Need at least two of sleep / RHR / HRV.";
  } else if (flags.length >= 2) {
    status = "concern";
    note = `${modePrefix}Recovery signals suggest stress: ${flags.join(", ")}. Rest a day or two before attempting.`;
  } else if (flags.length === 1) {
    status = "stretch";
    note = `${modePrefix}One recovery flag: ${flags[0]}. Not blocking, but sleep well tonight.`;
  } else {
    status = "ready";
    note = `${modePrefix}Recovery baselines within normal range.`;
  }

  return {
    key: "recovery",
    label: "Recovery",
    status,
    ratio: status === "ready" ? 1 : status === "stretch" ? 0.7 : 0.4,
    current: sleep != null ? `sleep ${sleep}h avg` : "no recovery data",
    required: `≥${sleepThreshold}h sleep, RHR within +${rhrThreshold - 1} bpm, HRV within ${hrvThreshold + 1}% of baseline`,
    note,
  };
}

const VERDICT_ORDER: Verdict[] = [
  "comfortable",
  "achievable",
  "hard",
  "do_not_attempt",
];

function verdictFromDimensions(
  dims: DimensionAnalysis[],
  kind: TrailKind,
): Verdict {
  const relevant = dims.filter((d) => d.status !== "not_applicable");
  const has = (s: DimensionStatus) => relevant.some((d) => d.status === s);
  const count = (s: DimensionStatus) => relevant.filter((d) => d.status === s).length;
  const hasUnknown = has("unknown");
  // If any dim is UNKNOWN, we cannot honestly call the trail
  // "comfortable" — there's a real signal missing. Downgrade a would-be
  // comfortable to "achievable" so the copy reads "achievable with a
  // caveat" rather than "you're set."
  const downgrade = (v: Verdict): Verdict =>
    hasUnknown && v === "comfortable" ? "achievable" : v;

  // Day hikes are never "do not attempt". Anyone reasonably mobile can
  // walk a standard day hike with the right pacing + expectations —
  // shutting them down is condescending and wrong. The worst honest
  // verdict is "hard": doable, but you'll feel it. "Not in timeframe"
  // is reserved for long_day / summit_push / multi_day objectives
  // where a real fitness gap is dangerous, not just uncomfortable.
  if (kind === "day_hike") {
    if (count("stretch") >= 2 || has("concern") || has("not_in_timeframe")) {
      return "hard";
    }
    if (has("stretch") || has("closable")) return "achievable";
    return downgrade("comfortable");
  }

  // Worst-dimension gating for real objectives. Averaging dimensions
  // is how we let Wonderland slip through as 'achievable' with a
  // ratio-0.00 pack. Instead: any single not_in_timeframe kills the
  // verdict; any single stretch drops it at least to 'hard' for
  // summit_push and multi_day (where a weak dimension can bail you
  // out — turn around, no shame — but also lose you); long_day is
  // the same idea but slightly more forgiving.
  if (has("not_in_timeframe")) return "do_not_attempt";
  if (kind === "summit_push" || kind === "multi_day") {
    if (has("stretch") || has("concern")) return "hard";
    if (has("closable")) return "achievable";
    return downgrade("comfortable");
  }
  if (kind === "long_day") {
    if (count("stretch") >= 2 || has("concern")) return "hard";
    if (has("stretch")) return "hard"; // long_day tolerates one stretch less than the old rule
    if (has("closable")) return "achievable";
    return downgrade("comfortable");
  }
  // Fallback (never day_hike — that path returned above).
  if (count("stretch") >= 2 || has("concern")) return "hard";
  if (has("stretch") || has("closable")) return "achievable";
  return downgrade("comfortable");
}

function suggestAdjustments(
  trail: Trail,
  dims: DimensionAnalysis[],
  kind: TrailKind,
  verdict: Verdict,
): string[] {
  const s: string[] = [];
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d]));
  const gappy = (k: string) =>
    byKey[k]?.status === "stretch" || byKey[k]?.status === "not_in_timeframe";

  // "If you push it anyway" copy — for day hikes where we intentionally
  // don't shut the user down, give them what to expect + how to make
  // it work. Prevents the shame spiral of "the app said no".
  if (kind === "day_hike" && (verdict === "hard" || verdict === "achievable")) {
    if (gappy("endurance")) {
      s.push(
        `Pace it slow — plan ${(trail.typicalHours * 1.3).toFixed(1)} h instead of ${trail.typicalHours}. Rest breaks every 45 min.`,
      );
      s.push(
        "Expect stiff legs the next day. Eat + hydrate on trail and stretch after.",
      );
    }
    if (gappy("vertical")) {
      s.push(
        "On climbs: breathe by nose if possible; if you can't hold a short sentence, slow down until you can.",
      );
    }
    if (byKey.altitude?.status === "stretch") {
      s.push(
        "Mild altitude: pace conservatively for the first hour. Sip water constantly.",
      );
    }
    if (gappy("pack")) {
      s.push(
        `Go lighter than the guide — ${Math.round(trail.packWeightLb * 0.6)} lb is enough (water, a bar, one layer).`,
      );
    }
    if (byKey.recovery?.status === "concern") {
      s.push(
        "Recovery is off today — start slower, plan an early turnaround if it feels harder than expected.",
      );
    }
    if (s.length === 0) {
      s.push(
        "Nothing exceptional to prep for — go enjoy it.",
      );
    }
    return s;
  }

  // Longer / summit / multi-day objectives: keep the classic prep-plan tone.
  if (gappy("endurance")) {
    s.push(
      `Slow pace target: expect ${(trail.typicalHours * 1.3).toFixed(1)} hours instead of ${trail.typicalHours}.`,
    );
  }
  if (gappy("pack")) {
    const cur = trail.packWeightLb;
    s.push(
      `Reduce pack weight to ${Math.round(cur * 0.7)}–${Math.round(cur * 0.85)} lb.`,
    );
  }
  if (gappy("vertical")) {
    s.push(
      "Take frequent breaks on steep sections; pace by breathing (still able to talk).",
    );
  }
  if (byKey.altitude?.status === "concern") {
    s.push(
      "Sleep at moderate elevation the night before if possible. Hydrate aggressively.",
    );
  }
  if (byKey.recovery?.status === "concern") {
    s.push(
      "Prioritize sleep tonight and tomorrow before the trail; consider postponing 1-2 days.",
    );
  }
  return s;
}

export async function assessTrail(
  userId: number,
  trail: Trail,
  todayYmd: string,
  opts?: {
    excludeWorkoutIds?: number[];
    // Pre-loaded snapshot lets callers batch-assess many trails without
    // re-running the fitness query per call. Used by the /trails/discover
    // page which scores 10-30 trails at once for a region.
    snapshot?: FitnessSnapshot;
  },
): Promise<TrailAssessment> {
  const snap =
    opts?.snapshot ?? (await loadFitnessSnapshot(userId, opts));

  const daysUntilTrail = trail.targetDate
    ? Math.max(0, daysBetween(todayYmd, trail.targetDate))
    : null;
  const hasDate = daysUntilTrail != null;
  // If no date, project against a generous 12-week window (a real training
  // block). Not a user-facing number — just the ceiling for gap projection.
  const weeksAvailable = hasDate ? daysUntilTrail / 7 : 12;

  const kind = classifyTrail(trail);
  const dimensions: DimensionAnalysis[] = [
    analyzeEndurance(trail, snap, weeksAvailable, hasDate),
    analyzeVertical(trail, snap, weeksAvailable, hasDate, kind),
    analyzePack(trail, snap, weeksAvailable, hasDate, kind),
    analyzeAltitude(trail, snap, kind),
    analyzeRecovery(snap, kind),
  ];

  const verdict = verdictFromDimensions(dimensions, kind);
  const suggestedAdjustments = suggestAdjustments(trail, dimensions, kind, verdict);
  const weeksToReady = estimateWeeksToReady(dimensions, verdict);

  return {
    verdict,
    daysUntilTrail,
    weeksAvailable: hasDate ? +weeksAvailable.toFixed(1) : null,
    weeksToReady,
    dimensions,
    suggestedAdjustments,
    fitnessSnapshot: snap,
  };
}

/**
 * Rough estimate of how many weeks the user needs at typical growth
 * rates (10-15%/week endurance, 2 lb/week pack) to close their
 * largest remaining gap. Used as a headline number ("~14 weeks at
 * your current trajectory") on trail detail, so users get a specific
 * horizon instead of a vague verdict.
 *
 * Returns null when already ready (nothing to close) OR when the gap
 * would need >52 weeks (a year+ horizon isn't a useful number,
 * "postpone" is the honest answer).
 */
function estimateWeeksToReady(
  dims: DimensionAnalysis[],
  verdict: Verdict,
): number | null {
  if (verdict === "comfortable") return null;
  // Find the least-ready dimension by ratio. Concern/altitude/recovery
  // aren't buildable on a training timescale — skip them for this
  // estimate (their fix is rest, acclimatization, or route change).
  const buildable = dims.filter(
    (d) =>
      d.key === "endurance" || d.key === "vertical" || d.key === "pack",
  );
  let worstRatio = 1;
  for (const d of buildable) {
    if (d.ratio < worstRatio) worstRatio = d.ratio;
  }
  if (worstRatio >= 1) return null;
  // Weekly compounding at ~12%/week average growth: weeks = ln(1/r)/ln(1.12)
  const weeks = Math.log(1 / Math.max(0.01, worstRatio)) / Math.log(1.12);
  const rounded = Math.round(weeks);
  if (rounded < 1) return 1;
  if (rounded > 52) return null;
  return rounded;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: "Comfortable — go crush it",
  achievable: "Achievable with focused prep",
  hard: "Doable — expect to feel it",
  do_not_attempt: "Not in this timeframe — postpone",
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  comfortable: "text-accent",
  achievable: "text-blue-300",
  hard: "text-warn",
  do_not_attempt: "text-danger",
};

export const STATUS_COLOR: Record<DimensionStatus, string> = {
  ready: "text-accent",
  closable: "text-blue-300",
  stretch: "text-warn",
  concern: "text-warn",
  not_in_timeframe: "text-danger",
  unknown: "text-muted",
  not_applicable: "text-muted",
};

export const STATUS_LABEL: Record<DimensionStatus, string> = {
  ready: "READY",
  closable: "CLOSABLE",
  stretch: "STRETCH",
  concern: "CONCERN",
  not_in_timeframe: "GAP",
  unknown: "UNKNOWN",
  not_applicable: "N/A",
};
