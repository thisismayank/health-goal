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

import { and, desc, eq, gte, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyMetric,
  strengthExercise,
  userProfile,
  workout,
  type Trail,
} from "@/db/schema";
import {
  hrvBaseline,
  rhrBaseline,
  sleepBaseline,
  type Baseline,
} from "@/lib/analytics/baselines";
import { ymd } from "@/lib/date";
import { stepAerobicMinutesPerWeek } from "@/lib/analytics/step-credit";
import { estimatedVerticalMeters, metersToFeet } from "./summit";

// -------- Fitness snapshot --------

export type FitnessSnapshot = {
  longestRecentSessionMin: number;
  weeklyAerobicMinutes: number;
  maxSingleSessionVertFt: number;
  cumulative90dVertFt: number;
  // Kept for display / coach context / prep-plan copy. NOT used for
  // pack readiness scoring anymore — see squatEst1RmKg + loadedHikes8w
  // for the derived pack signals.
  maxPackLb: number;
  maxAltitudeReachedFt: number | null; // from prior assessed trails; null if unknown
  rhr: Baseline;
  hrv: Baseline;
  sleepAvgHours: number | null;
  vo2Max: number | null;
  // Derived pack-readiness signals. Replaces the old
  // "user's max pack in the window" input, which required manual
  // pack-weight entry on every hike and produced garbage numbers.
  //   - Capacity: best est. squat 1RM (kg) in the 90d window. Proxy
  //     for load-bearing lower-body strength.
  //   - Adaptation: count of completed LOADED_HIKE sessions in the
  //     last 8 weeks. Whether the user's actually training with a
  //     pack on their back, regardless of what number they typed.
  //   - Bodyweight: to normalize squat vs BW ratio.
  squatEst1RmKg: number | null;
  loadedHikes8w: number;
  bodyweightKg: number | null;
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

  const workoutAerobicMin28 = workouts28
    .filter((w) => AEROBIC_CATS.includes(w.type))
    .reduce((s, w) => s + (w.durationSeconds ?? 0) / 60, 0);
  // Ambient-step credit — see lib/analytics/step-credit.ts. Turns
  // 15-20k step days into aerobic minutes for the endurance analysis
  // so users don't get scored as sedentary when they're clearly
  // moving all day.
  const stepAerobicWeekly = await stepAerobicMinutesPerWeek({
    userId,
    windowDays: 28,
    now,
  });
  const weeklyAerobic = Math.round(workoutAerobicMin28 / 4 + stepAerobicWeekly);

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

  // Derived pack signals — see analyzePack for how they combine.
  // Bodyweight comes from the profile row; used to normalize the
  // squat-1RM capacity signal. Nullable when the user hasn't set it.
  const windowStart56 = new Date(now.getTime() - 56 * 86_400_000);
  const loadedHikes8w = workouts28
    .concat(
      workouts60.filter(
        (w) =>
          w.startTime >= windowStart56 &&
          w.startTime < new Date(now.getTime() - 28 * 86_400_000),
      ),
    )
    .filter((w) => w.type === "LOADED_HIKE").length;

  // Estimated squat 1RM from all logged squat sets in the 90d window,
  // using the Epley formula (weight × (1 + reps/30)) and taking the
  // best. Match on any exercise name containing "squat" so we catch
  // "Barbell squat", "Back squat", "Front squat" etc.
  const workoutIds90 = workouts90.map((w) => w.id);
  let squatEst1RmKg: number | null = null;
  if (workoutIds90.length > 0) {
    const sets = await db
      .select({
        exerciseName: strengthExercise.exerciseName,
        reps: strengthExercise.reps,
        weightKg: strengthExercise.weightKg,
      })
      .from(strengthExercise)
      .where(inArray(strengthExercise.workoutId, workoutIds90));
    for (const s of sets) {
      if (!/squat/i.test(s.exerciseName)) continue;
      if (s.reps == null || s.weightKg == null || s.weightKg <= 0) continue;
      const est = s.weightKg * (1 + s.reps / 30);
      if (squatEst1RmKg == null || est > squatEst1RmKg) squatEst1RmKg = est;
    }
  }

  const [profile] = await db
    .select({ currentWeightKg: userProfile.currentWeightKg })
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);
  const bodyweightKg = profile?.currentWeightKg ?? null;

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
    squatEst1RmKg,
    loadedHikes8w,
    bodyweightKg,
  };
}


// -------- Assessment --------

import type { DimensionStatus, Verdict } from "./verdict-labels";
export type { DimensionStatus, Verdict } from "./verdict-labels";
export {
  VERDICT_LABEL,
  VERDICT_COLOR,
  VERDICT_HEADLINE,
  VERDICT_SUBHEAD,
  STATUS_LABEL,
  STATUS_COLOR,
} from "./verdict-labels";

export type DimensionAnalysis = {
  key:
    | "endurance"
    | "vertical"
    | "pack"
    | "altitude"
    | "recovery"
    | "terrain";
  label: string;
  status: DimensionStatus;
  ratio: number; // 0-1 current-to-required (or interpreted per dimension)
  current: string; // human-readable
  required: string;
  note: string;
};

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
// PACK_GROWTH_LB_PER_WEEK was used by the pre-2026-08 pack analyzer
// that projected linear pack-weight growth off manually-entered
// numbers. Replaced by the strength+adaptation model in analyzePack;
// see comments there.

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

  // Day-hike short-circuit: a light day pack (≤10 lb — water, snacks,
  // a layer) is trivial. No benchmark required.
  if (kind === "day_hike" && needed <= 10) {
    return {
      key: "pack",
      label: "Pack",
      status: "ready",
      ratio: 1,
      current: "day pack",
      required: `${needed} lb`,
      note: "Trivial load for most people. No prep required.",
    };
  }

  // For anything heavier we derive pack readiness from two signals:
  //   1. Capacity: est. squat 1RM as fraction of bodyweight.
  //   2. Adaptation: count of prescribed LOADED_HIKE sessions
  //      completed in the last 8 weeks.
  //
  // Rationale: pack-weight-typed-into-a-form (the old signal) required
  // manual entry on every completion, wasn't captured on Strava
  // imports, and conflated "biggest weight ever carried once" with
  // "can carry it for 10 hours." Squat strength maps to real
  // load-bearing capacity; loaded-hike frequency maps to whether the
  // user's actually adapting to weight on the trail. Both are things
  // we already know from data we're collecting anyway.
  const { squatEst1RmKg, bodyweightKg, loadedHikes8w } = snap;

  const capacityRatio = capacityFromSquat(squatEst1RmKg, bodyweightKg);
  const adaptationRatio = Math.min(1, loadedHikes8w / 4);
  const capacityKnown = capacityRatio != null;
  const adaptationKnown = loadedHikes8w > 0 || squatEst1RmKg != null;

  // Nothing to score against: neither strength nor loaded-hike data.
  // Surface UNKNOWN so the coach can prompt the user to log squats
  // or start prescribed loaded hikes rather than pretending we have
  // a real read.
  if (!capacityKnown && !adaptationKnown) {
    return {
      key: "pack",
      label: "Pack",
      status: "unknown",
      ratio: 0,
      current: "no strength or loaded-hike data",
      required: `${needed} lb`,
      note: `${needed} lb pack — log a squat set or complete a prescribed loaded hike and we'll be able to tell you if you're ready.`,
    };
  }

  // Weight the two signals. Capacity 60%, adaptation 40% — a strong
  // squatter who hasn't done loaded hikes is more ready than a
  // weekend-warrior who's done 4 loaded hikes but can't squat their
  // bodyweight. When one is missing, the other carries the score.
  let combined: number;
  if (capacityKnown && adaptationKnown) {
    combined = 0.6 * (capacityRatio ?? 0) + 0.4 * adaptationRatio;
  } else if (capacityKnown) {
    combined = capacityRatio ?? 0;
  } else {
    combined = adaptationRatio;
  }

  // Bar rises with pack size. A 15 lb day pack for a long day is
  // easy to be ready for; a 40 lb Denali kit isn't.
  const barByNeed =
    needed <= 20 ? 0.4 : needed <= 30 ? 0.65 : /* 30+ */ 0.85;

  // Time-aware upgrade path: even if combined score is short of the
  // bar, if the user has plenty of weeks to build (both capacity via
  // strength and adaptation via loaded hikes), classify as closable
  // rather than a hard gap.
  const closableWithRunway = weeksAvail >= 20 && combined >= barByNeed * 0.5;

  let status: DimensionStatus;
  if (combined >= barByNeed) status = "ready";
  else if (closableWithRunway) status = "closable";
  else if (combined >= barByNeed * 0.5) status = "stretch";
  else status = "not_in_timeframe";

  const capacityLabel =
    squatEst1RmKg != null && bodyweightKg != null
      ? `squat ≈${Math.round(squatEst1RmKg)}kg (${(squatEst1RmKg / bodyweightKg).toFixed(2)}× BW)`
      : squatEst1RmKg != null
        ? `squat ≈${Math.round(squatEst1RmKg)}kg (bodyweight not set)`
        : "no squat data";
  const adaptationLabel = `${loadedHikes8w} loaded hike${loadedHikes8w === 1 ? "" : "s"} in 8wk`;
  const current = `${capacityLabel} · ${adaptationLabel}`;

  const kindNote =
    kind === "multi_day"
      ? "Multi-day: pack matters for sustained carry, though many treks (Kili/EBC) use porters."
      : kind === "summit_push"
        ? "Summit push: this is what you carry on the day, no porters."
        : "Loaded carry.";

  return {
    key: "pack",
    label: "Pack",
    status,
    ratio: Math.min(1, combined),
    current,
    required: `${needed} lb`,
    note:
      status === "ready"
        ? `${kindNote} Strength + loaded-hike adaptation look sufficient.`
        : status === "closable"
          ? `${kindNote} You have ${Math.round(weeksAvail)}wk. Get to 2× bodyweight on squat if you're under it; add a weekly loaded hike ramping to ${needed} lb.`
          : status === "stretch"
            ? `${kindNote} Below the bar for ${needed} lb. Expect the pack to be your limiter — go lighter on the day or accept slower pace.`
            : `${kindNote} Pack demand outpaces current strength + loaded-hike volume. Reduce weight or extend timeline.`,
  };
}

/**
 * Capacity ratio from squat 1RM. Full credit at 1.5× bodyweight
 * (a solid recreational lifter's back-squat, comfortably able to
 * carry expedition loads). No bodyweight → assume 80 kg reference
 * (western adult male-ish average) rather than refuse to compute.
 * Returns null when squat data itself is missing.
 */
function capacityFromSquat(
  squat1RmKg: number | null,
  bodyweightKg: number | null,
): number | null {
  if (squat1RmKg == null || squat1RmKg <= 0) return null;
  const bw = bodyweightKg && bodyweightKg > 0 ? bodyweightKg : 80;
  const ratio = squat1RmKg / bw / 1.5;
  return Math.max(0, Math.min(1, ratio));
}

function analyzeAltitude(
  trail: Trail,
  snap: FitnessSnapshot,
  kind: TrailKind,
  weeksAvail: number,
): DimensionAnalysis {
  const alt = trail.maxAltitudeFt;
  const known = snap.maxAltitudeReachedFt;

  // Multi-day treks bake acclimatization into the itinerary (climb
  // high, sleep low over N days). Guided summit pushes (Rainier DC,
  // Baker, most 14ers on the standard route) similarly include a
  // 1-2 night approach at intermediate altitude — a smaller but real
  // buffer. A day hike straight from sea level to the same summit
  // hits hardest.
  //
  // For summit_push, only apply the buffer when the user has enough
  // runway to do one prior high-altitude trip (~8 weeks). Otherwise
  // it's just a big single push with no adaptation.
  const acclimatizationBuffer =
    kind === "multi_day"
      ? 3000
      : kind === "summit_push" && weeksAvail >= 8
        ? 1500
        : 0;
  const effectiveAlt = alt - acclimatizationBuffer;

  // Prior recent exposure reduces effective altitude further. Not
  // 1:1 — going to 12k once doesn't make you Nepal-ready — but if
  // your recent high is close to the target, the shock is smaller.
  const priorExposureBuffer =
    known != null ? Math.max(0, Math.min(2000, known - 6000) / 2) : 0;
  const netEffectiveAlt = effectiveAlt - priorExposureBuffer;

  let status: DimensionStatus;
  let note: string;
  const modeNote =
    kind === "multi_day"
      ? "Multi-day acclimatization built into the trek — tolerance is dramatically better than a single-day push. "
      : kind === "summit_push" && weeksAvail >= 8
        ? "Guided summit itineraries include a 1-2 night approach at intermediate altitude; use that plus one prior high-altitude trip in the training block. "
        : "";

  if (netEffectiveAlt < 6000) {
    status = "ready";
    note = `${modeNote}Sub-alpine altitude — no acclimatization concern.`;
  } else if (netEffectiveAlt < 8000) {
    status = "ready";
    note = `${modeNote}Mild elevation — most sea-level residents handle this fine.`;
  } else if (netEffectiveAlt < 10000) {
    status = "stretch";
    note = `${modeNote}Effective ~8–10k ft — sea-level residents may feel it (headache, shortness of breath). Pace conservatively.`;
  } else if (netEffectiveAlt < 12000) {
    status = weeksAvail >= 12 ? "closable" : "concern";
    note =
      status === "closable"
        ? `${modeNote}Effective ~10–12k ft. Closable with a graded exposure block: one hike to 8-9k in the 2 months before the trip.`
        : `${modeNote}Effective ~10–12k ft — real altitude. Prior acclimatization within the last 60 days helps; going direct from sea level is uncomfortable.`;
  } else if (netEffectiveAlt < 14000) {
    status = weeksAvail >= 12 ? "closable" : "concern";
    note =
      status === "closable"
        ? `${modeNote}Effective ~12–14k ft. Closable with real acclimatization: a night at 8-10k a few weeks out, then the guided approach at altitude the day before.`
        : `${modeNote}Effective ~12–14k ft — significant thin air. Sleep the night before at moderate altitude if possible.`;
  } else {
    // 14k+ effective. Bar rises steeply with altitude — a 14er is not
    // the same as Denali. Bucket by trail altitude, cross with runway
    // and prior exposure.
    const priorHigh = known ?? 0;
    if (alt >= 18000) {
      // Expedition altitude (Denali, Aconcagua, 7000m+ peaks). Requires
      // proven prior high-altitude experience regardless of runway;
      // acclimatization alone doesn't build cellular adaptation the
      // first time. This is a hard gate.
      if (priorHigh >= 14000) {
        status = weeksAvail >= 12 ? "closable" : "stretch";
        note = `${modeNote}Above 18k ft — expedition altitude. Your prior high (${priorHigh.toLocaleString()} ft) makes this closable, but expect a formal 6-8 wk acclimatization protocol.`;
      } else {
        status = "not_in_timeframe";
        note = `${modeNote}Above 18k ft with no prior high-altitude experience (need at least a 14k+ objective under your belt first). This isn't closable in one season — build up on lower peaks first.`;
      }
    } else if (alt >= 16000) {
      // 16-18k (Aconcagua's approach, Mera Peak). Closable with runway
      // AND prior exposure to 12k+. Otherwise stretch.
      if (weeksAvail >= 12 && priorHigh >= 12000) {
        status = "closable";
        note = `${modeNote}16-18k ft. Real high altitude — needs the full acclimatization block: progressive exposure to 10-12k a month out, then a night at intermediate altitude before the push.`;
      } else if (priorHigh >= 10000) {
        status = "stretch";
        note = `${modeNote}16-18k ft with limited prior exposure. Doable with a proper acclimatization protocol but expect it to be humbling.`;
      } else {
        status = "not_in_timeframe";
        note = `${modeNote}16-18k ft with no prior altitude above 10k. Build up on a 12-14k objective before attempting this — the physiology needs a rehearsal.`;
      }
    } else if (weeksAvail >= 12) {
      // 14-16k (Rainier, Whitney, standard 14ers). Closable with runway.
      status = "closable";
      note = `${modeNote}14-16k ft. Needs a formal acclimatization plan (progressive exposure days + a night at intermediate altitude before the summit push). You have ${Math.round(weeksAvail)}wk to build it in.`;
    } else if (weeksAvail >= 4) {
      status = "stretch";
      note = `${modeNote}14-16k ft with limited runway. Book at least one high day (8-10k+) before your trip and lean hard on the guided acclimatization protocol.`;
    } else {
      status = "not_in_timeframe";
      note = `${modeNote}14k+ ft with under 4 weeks and no prior high-altitude exposure. Not safe to attempt without a proper acclimatization block. Postpone.`;
    }
  }

  return {
    key: "altitude",
    label: "Altitude",
    status,
    ratio:
      netEffectiveAlt < 8000
        ? 1
        : netEffectiveAlt < 10000
          ? 0.7
          : netEffectiveAlt < 12000
            ? 0.5
            : netEffectiveAlt < 14000
              ? 0.4
              : 0.3,
    current:
      known != null
        ? `last high point: ${known.toLocaleString()} ft`
        : "no altitude history",
    required: `${alt.toLocaleString()} ft${acclimatizationBuffer > 0 ? ` (effective ~${effectiveAlt.toLocaleString()} ft with itinerary acclimatization)` : ""}`,
    note,
  };
}

// Terrain/skills gate. Hard-caps the verdict for objectives whose
// difficulty is about skill (rope work, self-arrest, exposure), not
// fitness. Devin r3 blocker: Denali (mountaineering) was reading
// 'Doable — expect to feel it' for a Class E walker because none of
// the fitness dims tripped a hard gate. Terrain now does.
//
// Signal: current Hiker Class (userClassIndex) vs the class this
// terrain typically requires.
//
// Class ladder: E=0, D=1, C=2, B=3, A=4, S=5 (RANKS in ./rank.ts).
//   - mountaineering  → needs A minimum (4). Below = not_in_timeframe.
//   - technical       → needs B (3). Below = stretch.
//   - hard            → needs C (2). Below = stretch.
//   - moderate / easy → ready.
function analyzeTerrain(
  trail: Trail,
  userClassIndex: number,
): DimensionAnalysis {
  const grade = trail.terrainGrade;

  if (grade === "easy" || grade === "moderate") {
    return {
      key: "terrain",
      label: "Terrain",
      status: "ready",
      ratio: 1,
      current: `Class ${classLetterFromIndex(userClassIndex)}`,
      required: grade,
      note: `${grade === "easy" ? "Established trail — no skill demands." : "Moderate terrain — occasional scrambling. No special skills needed."}`,
    };
  }

  const requiredIndex =
    grade === "hard"
      ? 2 // C
      : grade === "technical"
        ? 3 // B
        : /* mountaineering */ 4; // A

  if (userClassIndex >= requiredIndex) {
    return {
      key: "terrain",
      label: "Terrain",
      status: "ready",
      ratio: 1,
      current: `Class ${classLetterFromIndex(userClassIndex)}`,
      required: `${grade} (Class ${classLetterFromIndex(requiredIndex)}+)`,
      note:
        grade === "mountaineering"
          ? "Mountaineering terrain — glacier travel, rope work, self-arrest. Your class covers it."
          : grade === "technical"
            ? "Technical terrain — Class 3 with exposure. Your class covers it."
            : "Hard terrain — steep, sustained. Your class covers it.",
    };
  }

  // User is below the required class. Gate strictness by grade:
  //   - mountaineering: always not_in_timeframe. No amount of fitness
  //     substitutes for glacier travel, self-arrest, crevasse rescue.
  //     Must hire a guide or take a course first.
  //   - technical: not_in_timeframe if gap >= 2 (Class E → B); stretch
  //     if gap == 1 (Class A user missing a class). Real Class 3
  //     scrambling with exposure isn't trivially built up.
  //   - hard: always stretch max — sustained steep terrain IS buildable
  //     via progressive fitness + moderate scrambles. Don't hard-gate.
  const gap = requiredIndex - userClassIndex;
  const status: DimensionStatus =
    grade === "mountaineering"
      ? "not_in_timeframe"
      : grade === "technical" && gap >= 2
        ? "not_in_timeframe"
        : "stretch";
  const note =
    grade === "mountaineering"
      ? `Mountaineering: glacier travel, roped teams, ice axe + crampons, crevasse rescue. You're Class ${classLetterFromIndex(userClassIndex)} — needs Class A. Hire a guided service (RMI, IMG, AAI) or take a mountaineering course first.`
      : grade === "technical"
        ? `Technical: Class 3 scrambling with real exposure. You're Class ${classLetterFromIndex(userClassIndex)} — build up on Class 2 scrambles before this.`
        : `Hard terrain — sustained steep sections. You're Class ${classLetterFromIndex(userClassIndex)} — build up on moderate objectives first.`;

  return {
    key: "terrain",
    label: "Terrain",
    status,
    ratio: userClassIndex / Math.max(1, requiredIndex),
    current: `Class ${classLetterFromIndex(userClassIndex)}`,
    required: `${grade} (Class ${classLetterFromIndex(requiredIndex)}+)`,
    note,
  };
}

function classLetterFromIndex(i: number): string {
  return ["E", "D", "C", "B", "A", "S"][Math.max(0, Math.min(5, i))] ?? "E";
}

// Class index derivation. Lazy-import to avoid dragging rank + stats
// into the module graph for callers that pass userClassIndex directly.
async function deriveUserClassIndex(userId: number): Promise<number> {
  const { computeCharacterSheet } = await import("./stats");
  const { computeRank, RANKS } = await import("./rank");
  const sheet = await computeCharacterSheet(userId);
  const rank = computeRank(sheet);
  const idx = RANKS.indexOf(rank.current);
  return idx < 0 ? 0 : idx;
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

  // "Signal exists" test uses baseline presence, not today's delta.
  // Devin r3 caught the bug: 14 days of RHR history was being reported
  // as UNKNOWN because today's RHR hadn't been synced yet, dropping
  // rhrDelta to null. Baselines encode a recent window (see baselines.ts)
  // and are the honest test for "do we have enough recovery data."
  const signalCount =
    (snap.rhr.baseline != null ? 1 : 0) +
    (snap.hrv.baseline != null ? 1 : 0) +
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
    // Pre-computed user class index (RANKS: E=0..S=5). Same batching
    // reason — discover computes rank once for the user, per-trail
    // analyzers just consume the index. When omitted, we lazily
    // compute it here via computeCharacterSheet + computeRank.
    userClassIndex?: number;
  },
): Promise<TrailAssessment> {
  const snap =
    opts?.snapshot ?? (await loadFitnessSnapshot(userId, opts));

  const userClassIndex =
    opts?.userClassIndex ?? (await deriveUserClassIndex(userId));

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
    analyzeAltitude(trail, snap, kind, weeksAvailable),
    analyzeTerrain(trail, userClassIndex),
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
  // Also skip UNKNOWN dims: they carry ratio=0 as a "no data" placeholder
  // and would otherwise force the estimate to the 41-week global-max
  // cap on every trail with missing pack/recovery data (Devin r3 #3:
  // "About 41 weeks" appearing on Skyline, Rainier, Wonderland, Denali).
  const buildable = dims.filter(
    (d) =>
      (d.key === "endurance" || d.key === "vertical" || d.key === "pack") &&
      d.status !== "unknown",
  );
  if (buildable.length === 0) return null;
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

// Verdict + status label maps live in ./verdict-labels (leaf module,
// no DB imports). They're re-exported at the top of this file so
// existing `import { VERDICT_LABEL } from "trail-assessment"` callers
// keep working, but client components should import directly from
// ./verdict-labels to avoid pulling drizzle/postgres into the browser
// bundle.
