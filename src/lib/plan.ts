export type Phase = {
  number: number;
  name: string;
  startWeek: number;
  endWeek: number;
  objectives: string[];
};

export const PHASES: Phase[] = [
  {
    number: 1,
    name: "Rebuild",
    startWeek: 1,
    endWeek: 8,
    objectives: [
      "Restore easy running",
      "Establish consistent strength training",
      "Build Zone 2 volume",
      "Develop tolerance for stair/incline work",
    ],
  },
  {
    number: 2,
    name: "Base + Vertical Capacity",
    startWeek: 9,
    endWeek: 16,
    objectives: [
      "Increase long-session duration",
      "Increase vertical gain",
      "Introduce light/moderate backpack load",
      "Maintain two upper-body exposures/week",
    ],
  },
];

export const TOTAL_SEEDED_WEEKS =
  PHASES[PHASES.length - 1]?.endWeek ?? 0;

export function phaseForWeek(week: number): Phase {
  return (
    PHASES.find((p) => week >= p.startWeek && week <= p.endWeek) ??
    PHASES[PHASES.length - 1]
  );
}

export type LongSessionTarget = {
  durationMinutes: number;
  packLb: number;
  elevationFt: number;
};

export const LONG_SESSION_BY_WEEK: Record<number, LongSessionTarget> = {
  // Phase 1 — Rebuild
  1: { durationMinutes: 60, packLb: 0, elevationFt: 0 },
  2: { durationMinutes: 70, packLb: 0, elevationFt: 0 },
  3: { durationMinutes: 80, packLb: 0, elevationFt: 0 },
  4: { durationMinutes: 90, packLb: 0, elevationFt: 0 },
  5: { durationMinutes: 100, packLb: 0, elevationFt: 500 },
  6: { durationMinutes: 110, packLb: 0, elevationFt: 500 },
  7: { durationMinutes: 120, packLb: 0, elevationFt: 1000 },
  8: { durationMinutes: 120, packLb: 5, elevationFt: 1000 },
  // Phase 2 — Base + Vertical Capacity
  9: { durationMinutes: 120, packLb: 5, elevationFt: 1000 },
  10: { durationMinutes: 135, packLb: 5, elevationFt: 1000 },
  11: { durationMinutes: 150, packLb: 10, elevationFt: 1500 },
  12: { durationMinutes: 150, packLb: 15, elevationFt: 1500 },
  13: { durationMinutes: 165, packLb: 15, elevationFt: 2000 },
  14: { durationMinutes: 165, packLb: 20, elevationFt: 2000 },
  15: { durationMinutes: 180, packLb: 20, elevationFt: 2000 },
  16: { durationMinutes: 180, packLb: 20, elevationFt: 2000 },
};

export const EASY_RUN_MINUTES_BY_WEEK: Record<number, number> = {
  // Phase 1 — 30 to 45
  1: 30, 2: 32, 3: 34, 4: 36, 5: 38, 6: 40, 7: 42, 8: 45,
  // Phase 2 — 45 to 50, alternating
  9: 45, 10: 45, 11: 45, 12: 50, 13: 45, 14: 50, 15: 45, 16: 50,
};

// Groups of session categories that should be considered "the same kind of
// stress" for planned-vs-actual matching. An imported workout should only
// auto-complete a planned session when they share at least one group.
import type { SessionCategory } from "@/db/schema";

const CATEGORY_GROUPS: Record<string, SessionCategory[]> = {
  running: ["EASY_RUN", "QUALITY_RUN"],
  aerobic: ["EASY_RUN", "QUALITY_RUN", "ZONE2_CARDIO"],
  strength: [
    "UPPER_STRENGTH",
    "LOWER_STRENGTH",
    "FULL_BODY_STRENGTH",
    "MOUNTAIN_LEGS",
  ],
  mountain: [
    "STAIRMASTER",
    "INCLINE_TREADMILL",
    "OUTDOOR_HIKE",
    "LOADED_HIKE",
    "LONG_MOUNTAIN_SESSION",
    "MOUNTAIN_LEGS",
  ],
  // Recovery days accept ANY light activity — a walk, easy jog,
  // stroll on an incline treadmill, or a mobility session all count.
  // Previously this was ["ACTIVE_RECOVERY", "MOBILITY"] which was so
  // narrow that a Sunday hike didn't count as the planned recovery,
  // wrecking compliance for anyone whose actual life includes walking.
  recovery: [
    "ACTIVE_RECOVERY",
    "MOBILITY",
    "OUTDOOR_HIKE",
    "EASY_RUN",
    "ZONE2_CARDIO",
    "INCLINE_TREADMILL",
    "CROSS_TRAINING",
  ],
};

export function categoriesCompatible(
  a: SessionCategory,
  b: SessionCategory,
): boolean {
  if (a === b) return true;
  for (const group of Object.values(CATEGORY_GROUPS)) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  return false;
}

const STRENGTH_CATEGORIES: SessionCategory[] = [
  "UPPER_STRENGTH",
  "LOWER_STRENGTH",
  "FULL_BODY_STRENGTH",
  "MOUNTAIN_LEGS",
];

// Fractions of planned duration that qualify as a completion for
// duration-measurable session types.
const CARDIO_DURATION_FLOOR = 0.7;
// Strength floor is deliberately low — Strava strips rest-between-sets from
// activity duration, so a real 60-min lift session often reports as 15-20 min
// active time. If a strength-category workout exists on the planned date,
// that's the honest signal that the session happened.
const STRENGTH_MIN_MINUTES = 5;
const CARDIO_MIN_MINUTES = 15;

export function sessionCompletionQualifies(
  actualDurationSeconds: number | null,
  actualCategory: SessionCategory,
  planned: {
    targetDurationMinutes: number | null;
    sessionCategory: SessionCategory;
  },
): boolean {
  if (!categoriesCompatible(actualCategory, planned.sessionCategory)) {
    return false;
  }
  const actualMin =
    actualDurationSeconds != null ? actualDurationSeconds / 60 : 0;

  // Strength: presence-based, not duration-based. Strava's activity duration
  // strips rest between sets — a real 60-min lift often reports as 15-20 min
  // of "active time." Trust that a strength-category workout on the day means
  // the strength session happened.
  if (STRENGTH_CATEGORIES.includes(planned.sessionCategory)) {
    return actualMin >= STRENGTH_MIN_MINUTES;
  }

  // Cardio-focused (runs, hikes, stairs, long mountain, recovery walks):
  // must hit ≥70% of the target duration. Cardio duration is a real signal
  // because there's no "rest between sets" — you're moving or you're not.
  if (planned.targetDurationMinutes == null) return actualMin >= CARDIO_MIN_MINUTES;
  return actualMin >= planned.targetDurationMinutes * CARDIO_DURATION_FLOOR;
}
