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

import { and, desc, eq, gte } from "drizzle-orm";
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
): Promise<FitnessSnapshot> {
  const now = new Date();
  const windowStart60 = new Date(now.getTime() - 60 * 86_400_000);
  const windowStart90 = new Date(now.getTime() - 90 * 86_400_000);

  const [workouts60, workouts90] = await Promise.all([
    db
      .select()
      .from(workout)
      .where(
        and(eq(workout.userId, userId), gte(workout.startTime, windowStart60)),
      ),
    db
      .select()
      .from(workout)
      .where(
        and(eq(workout.userId, userId), gte(workout.startTime, windowStart90)),
      ),
  ]);

  const longestRecentMin = Math.round(
    workouts60.reduce(
      (max, w) => Math.max(max, (w.durationSeconds ?? 0) / 60),
      0,
    ),
  );

  const aerobicMin60 = workouts60
    .filter((w) => AEROBIC_CATS.includes(w.type))
    .reduce((s, w) => s + (w.durationSeconds ?? 0) / 60, 0);
  const weeklyAerobic = Math.round(aerobicMin60 / (60 / 7));

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

function analyzeEndurance(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  hasDate: boolean,
): DimensionAnalysis {
  const neededMin = trail.typicalHours * 60;
  const longest = snap.longestRecentSessionMin;
  const weekly = snap.weeklyAerobicMinutes;

  // Multi-signal endurance readiness. Steve House / Uphill Athlete guidance:
  // - You do NOT need to pre-record a session equal to the trail duration.
  // - Longest recent session ~50% of trail + weekly aerobic base ≥ trail
  //   duration ≈ ready to extend on the day.
  // - Terrain grade adjusts thresholds (technical/mountaineering strict,
  //   easy relaxed).
  const strictness =
    trail.terrainGrade === "mountaineering"
      ? 1.15
      : trail.terrainGrade === "technical"
        ? 1.1
        : trail.terrainGrade === "easy"
          ? 0.85
          : 1.0;

  const longestReadyMin = neededMin * 0.5 * strictness; // e.g. 105 min for a 210-min trail
  const longestSoloReadyMin = neededMin * 0.65 * strictness; // strong solo signal
  const weeklyReadyMin = neededMin * 1.0 * strictness; // e.g. 210 min/wk for 210-min trail
  const longestClosableMin = neededMin * 0.3 * strictness;
  const weeklyClosableMin = neededMin * 0.7 * strictness;

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

  const noteReady =
    `Your longest recent session (${longest} min) is ~${Math.round((longest / neededMin) * 100)}% of trail duration; ` +
    `weekly aerobic base is ${weekly} min/wk. Base fitness supports extending to the trail duration on the day.`;
  const noteClosable =
    `Longest recent session ${longest} min · weekly aerobic ${weekly} min/wk. Target: longest ~${Math.round(longestReadyMin)} min + weekly ~${Math.round(weeklyReadyMin)} min. ` +
    (hasDate ? `Buildable in ${weeksAvail.toFixed(1)} weeks.` : "Buildable with a focused block.");
  const noteStretch =
    `Longest ${longest} min + weekly ${weekly} min/wk are both below target (need ~${Math.round(longestReadyMin)} min longest, ~${Math.round(weeklyReadyMin)} min/wk). ` +
    (hasDate
      ? `${weeksAvail.toFixed(1)} weeks is tight — expect real fatigue.`
      : "Expect fatigue late in the day without a proper build.");
  const noteGap =
    `Aerobic gap is large: longest ${longest} min and weekly ${weekly} min/wk are well below the ~${Math.round(longestReadyMin)} min / ~${Math.round(weeklyReadyMin)} min-per-week base needed.` +
    (hasDate ? " Time available not enough to close it." : " Requires a substantial training block.");

  const notes: Record<DimensionStatus, string> = {
    ready: noteReady,
    closable: noteClosable,
    stretch: noteStretch,
    not_in_timeframe: noteGap,
    concern: noteReady,
    not_applicable: noteReady,
  };

  return {
    key: "endurance",
    label: "Endurance",
    status,
    ratio: combinedRatio,
    current: `${longest} min longest · ${weekly} min/wk`,
    required: `~${Math.round(longestReadyMin)} min longest · ~${Math.round(weeklyReadyMin)} min/wk`,
    note: notes[status],
  };
}

function analyzeVertical(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  _hasDate: boolean,
): DimensionAnalysis {
  const needed = trail.elevationGainFt;
  const cur = snap.maxSingleSessionVertFt;
  const projected = projectedCapacity(
    Math.max(cur, 100),
    weeksAvail,
    WEEKLY_VERTICAL_GROWTH,
  );
  const ratio = cur / Math.max(1, needed);
  const projRatio = projected / needed;

  let status: DimensionStatus;
  if (ratio >= 0.8) status = "ready";
  else if (projRatio >= 0.8) status = "closable";
  else if (projRatio >= 0.5) status = "stretch";
  else status = "not_in_timeframe";

  return {
    key: "vertical",
    label: "Vertical",
    status,
    ratio: Math.min(1, ratio),
    current: `${cur.toLocaleString()} ft (best recent session)`,
    required: `${needed.toLocaleString()} ft`,
    note:
      status === "ready"
        ? "Your recent vertical range covers the trail."
        : status === "closable"
          ? `Add stair or incline sessions to build toward ${needed.toLocaleString()} ft/day.`
          : status === "stretch"
            ? "Real vertical work needed; pace yourself on the day."
            : "Vertical gap too large — consider a shorter alternative.",
  };
}

function analyzePack(
  trail: Trail,
  snap: FitnessSnapshot,
  weeksAvail: number,
  _hasDate: boolean,
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

  const projected = cur + PACK_GROWTH_LB_PER_WEEK * Math.max(0, weeksAvail);
  const ratio = cur / Math.max(0.01, needed);
  const projRatio = projected / needed;

  let status: DimensionStatus;
  if (ratio >= 0.9) status = "ready";
  else if (projRatio >= 0.9) status = "closable";
  else if (projRatio >= 0.6) status = "stretch";
  else status = "not_in_timeframe";

  return {
    key: "pack",
    label: "Pack",
    status,
    ratio: Math.min(1, ratio),
    current: cur > 0 ? `${cur} lb (recent max)` : "no pack logged",
    required: `${needed} lb`,
    note:
      status === "ready"
        ? "You've handled this pack weight recently."
        : status === "closable"
          ? `Progressive loaded hikes: +${PACK_GROWTH_LB_PER_WEEK} lb/wk to reach ${needed} lb.`
          : status === "stretch"
            ? "Pack tolerance thin — consider going lighter on the day."
            : "Pack weight ambitious given your recent loading. Reduce or postpone.",
  };
}

function analyzeAltitude(trail: Trail, snap: FitnessSnapshot): DimensionAnalysis {
  const alt = trail.maxAltitudeFt;
  const known = snap.maxAltitudeReachedFt;

  let status: DimensionStatus;
  let note: string;
  if (alt < 6000) {
    status = "ready";
    note = "Sub-alpine altitude — no acclimatization concern.";
  } else if (alt < 8000) {
    status = "ready";
    note = "Mild elevation — most sea-level residents handle this fine.";
  } else if (alt < 10000) {
    status = "stretch";
    note =
      "8–10k ft — sea-level residents may feel it (headache, shortness of breath). Pace conservatively.";
  } else if (alt < 12000) {
    status = "concern";
    note =
      "10–12k ft — real altitude. Prior acclimatization within the last 60 days helps; going direct from sea level is uncomfortable.";
  } else if (alt < 14000) {
    status = "concern";
    note =
      "12–14k ft — significant thin air. Sleep the night before at moderate altitude if possible.";
  } else {
    status = "not_in_timeframe";
    note =
      "Above 14k ft — needs proper acclimatization protocol (multiple days at intermediate altitudes) before attempting.";
  }

  return {
    key: "altitude",
    label: "Altitude",
    status,
    ratio: alt < 8000 ? 1 : alt < 10000 ? 0.7 : alt < 12000 ? 0.5 : 0.3,
    current: known != null ? `last high point: ${known.toLocaleString()} ft` : "no altitude history",
    required: `${alt.toLocaleString()} ft`,
    note,
  };
}

function analyzeRecovery(snap: FitnessSnapshot): DimensionAnalysis {
  const rhrDelta = snap.rhr.deltaAbs;
  const hrvDelta = snap.hrv.deltaPct;
  const sleep = snap.sleepAvgHours;

  const flags: string[] = [];
  if (rhrDelta != null && rhrDelta >= 8) flags.push(`RHR +${rhrDelta} bpm`);
  if (hrvDelta != null && hrvDelta <= -15) flags.push(`HRV ${hrvDelta}%`);
  if (sleep != null && sleep < 6.5) flags.push(`sleep ${sleep}h avg`);

  let status: DimensionStatus;
  let note: string;
  if (flags.length >= 2) {
    status = "concern";
    note = `Recovery signals suggest stress: ${flags.join(", ")}. Rest a day or two before attempting.`;
  } else if (flags.length === 1) {
    status = "stretch";
    note = `One recovery flag: ${flags[0]}. Not blocking, but sleep well tonight.`;
  } else {
    status = "ready";
    note = "Recovery baselines within normal range.";
  }

  return {
    key: "recovery",
    label: "Recovery",
    status,
    ratio: status === "ready" ? 1 : status === "stretch" ? 0.7 : 0.4,
    current: sleep != null ? `sleep ${sleep}h avg` : "no recovery data",
    required: "≥6.5h sleep, RHR within +7 bpm, HRV within -15% of baseline",
    note,
  };
}

const VERDICT_ORDER: Verdict[] = [
  "comfortable",
  "achievable",
  "hard",
  "do_not_attempt",
];

function verdictFromDimensions(dims: DimensionAnalysis[]): Verdict {
  const relevant = dims.filter((d) => d.status !== "not_applicable");
  const has = (s: DimensionStatus) => relevant.some((d) => d.status === s);
  const count = (s: DimensionStatus) => relevant.filter((d) => d.status === s).length;

  if (has("not_in_timeframe")) return "do_not_attempt";
  if (count("stretch") >= 2 || has("concern")) return "hard";
  if (has("stretch") || has("closable")) return "achievable";
  return "comfortable";
}

function suggestAdjustments(
  trail: Trail,
  dims: DimensionAnalysis[],
): string[] {
  const s: string[] = [];
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d]));
  if (byKey.endurance?.status === "stretch" || byKey.endurance?.status === "not_in_timeframe") {
    s.push(`Slow pace target: expect ${(trail.typicalHours * 1.3).toFixed(1)} hours instead of ${trail.typicalHours}.`);
  }
  if (byKey.pack?.status === "stretch" || byKey.pack?.status === "not_in_timeframe") {
    const cur = trail.packWeightLb;
    s.push(`Reduce pack weight to ${Math.round(cur * 0.7)}–${Math.round(cur * 0.85)} lb.`);
  }
  if (byKey.vertical?.status === "stretch" || byKey.vertical?.status === "not_in_timeframe") {
    s.push("Take frequent breaks on steep sections; pace by breathing (still able to talk).");
  }
  if (byKey.altitude?.status === "concern") {
    s.push("Sleep at moderate elevation the night before if possible. Hydrate aggressively.");
  }
  if (byKey.recovery?.status === "concern") {
    s.push("Prioritize sleep tonight and tomorrow before the trail; consider postponing 1-2 days.");
  }
  return s;
}

export async function assessTrail(
  userId: number,
  trail: Trail,
  todayYmd: string,
): Promise<TrailAssessment> {
  const snap = await loadFitnessSnapshot(userId);

  const daysUntilTrail = trail.targetDate
    ? Math.max(0, daysBetween(todayYmd, trail.targetDate))
    : null;
  const hasDate = daysUntilTrail != null;
  // If no date, project against a generous 12-week window (a real training
  // block). Not a user-facing number — just the ceiling for gap projection.
  const weeksAvailable = hasDate ? daysUntilTrail / 7 : 12;

  const dimensions: DimensionAnalysis[] = [
    analyzeEndurance(trail, snap, weeksAvailable, hasDate),
    analyzeVertical(trail, snap, weeksAvailable, hasDate),
    analyzePack(trail, snap, weeksAvailable, hasDate),
    analyzeAltitude(trail, snap),
    analyzeRecovery(snap),
  ];

  const verdict = verdictFromDimensions(dimensions);
  const suggestedAdjustments = suggestAdjustments(trail, dimensions);

  return {
    verdict,
    daysUntilTrail,
    weeksAvailable: hasDate ? +weeksAvailable.toFixed(1) : null,
    dimensions,
    suggestedAdjustments,
    fitnessSnapshot: snap,
  };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: "Comfortable — go crush it",
  achievable: "Achievable with focused prep",
  hard: "Hard — expect struggle",
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
  not_applicable: "text-muted",
};

export const STATUS_LABEL: Record<DimensionStatus, string> = {
  ready: "READY",
  closable: "CLOSABLE",
  stretch: "STRETCH",
  concern: "CONCERN",
  not_in_timeframe: "GAP",
  not_applicable: "N/A",
};
