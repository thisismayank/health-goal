/**
 * Activity substitution engine.
 *
 * Problem: the compliance loop's category-group matcher (see
 * lib/plan.ts::categoriesCompatible) is right that "strength doesn't
 * substitute for aerobic" but wrong that "a hike doesn't substitute
 * for zone-2 cardio." Real life is messier than category enums: the
 * user goes for an 80-minute walk on the day the plan wanted a
 * 45-minute Zone-2 spin, and the app pretends the session was
 * skipped. Compliance craters, coach nags, user opens Notion.
 *
 * This module adds a physio-equivalence fallback. If the actual and
 * planned sessions are BOTH movement-based (not strength) and the
 * MET-minute-adjusted stress of the actual session covers at least
 * ~70% of what the planned session would have delivered, we count
 * the actual as a substitution.
 *
 * Deliberately conservative:
 *   - Strength <-> aerobic never substitutes. Different adaptation.
 *   - The actual must be at least half the planned duration by
 *     wall-clock, even if MET-minutes look high. A 20-min stair
 *     blast doesn't substitute for a 3-hour long hike.
 *   - No downstream state change: substitutions still auto-link the
 *     workout to the planned session, but the raw workout data stays
 *     intact — we don't rewrite type or invent missing fields.
 */

import type { SessionCategory } from "@/db/schema";

// Rough MET values by category. Compendium-of-physical-activities-lite:
// intended to rank effort intensity, not calorie-count precisely. REST
// and UNKNOWN carry a nominal 1 (~sitting) and are excluded from the
// substitution path via MOVEMENT_CATEGORIES anyway.
const MET_BY_CATEGORY: Record<SessionCategory, number> = {
  EASY_RUN: 8,
  QUALITY_RUN: 10.5,
  ZONE2_CARDIO: 6.5,
  STAIRMASTER: 8.5,
  INCLINE_TREADMILL: 7,
  OUTDOOR_HIKE: 6,
  LOADED_HIKE: 7.5,
  LONG_MOUNTAIN_SESSION: 7,
  MOUNTAIN_LEGS: 6.5,
  ACTIVE_RECOVERY: 3.5,
  MOBILITY: 2.5,
  CROSS_TRAINING: 6,
  UPPER_STRENGTH: 4.5,
  LOWER_STRENGTH: 5,
  FULL_BODY_STRENGTH: 5,
  REST: 1,
  UNKNOWN: 1,
};

// Categories whose stress is duration-and-intensity-based rather
// than presence-based. Strength sessions are intentionally excluded:
// their adaptation signal isn't MET-minutes.
const MOVEMENT_CATEGORIES: SessionCategory[] = [
  "EASY_RUN",
  "QUALITY_RUN",
  "ZONE2_CARDIO",
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
  "MOUNTAIN_LEGS",
  "ACTIVE_RECOVERY",
  "MOBILITY",
  "CROSS_TRAINING",
];

// Thresholds. Set low enough that a good-faith substitute passes,
// high enough that a token walk can't game a mountain session.
const MET_MIN_RATIO_FLOOR = 0.7;
const DURATION_RATIO_FLOOR = 0.5;

function metMinutes(category: SessionCategory, durationMin: number): number {
  return MET_BY_CATEGORY[category] * durationMin;
}

function isMovement(cat: SessionCategory): boolean {
  return MOVEMENT_CATEGORIES.includes(cat);
}

export type SubstitutionCheck = {
  qualifies: boolean;
  reason:
    | "same_or_grouped_category" // existing category-group match handled by caller
    | "movement_substitute"      // physio-equivalent even if category differs
    | "actual_too_short"
    | "insufficient_effort"
    | "strength_mismatch"
    | "not_a_movement_session";
  actualMetMin: number;
  plannedMetMin: number;
};

/**
 * Physio-equivalence check for an actual workout against a planned
 * session, used as a fallback when categoriesCompatible returns
 * false. Returns a structured result so callers can log the reason
 * (helpful for the /train tooltip, for coach context, and for
 * debugging why a specific workout did or didn't auto-link).
 */
export function checkMovementSubstitute(
  actual: {
    category: SessionCategory;
    durationSeconds: number | null;
  },
  planned: {
    category: SessionCategory;
    targetDurationMinutes: number | null;
  },
): SubstitutionCheck {
  const actualMin = (actual.durationSeconds ?? 0) / 60;
  const plannedMin = planned.targetDurationMinutes ?? 0;
  const actualMet = metMinutes(actual.category, actualMin);
  const plannedMet = metMinutes(planned.category, plannedMin);

  if (!isMovement(actual.category) || !isMovement(planned.category)) {
    return {
      qualifies: false,
      reason: !isMovement(planned.category)
        ? "strength_mismatch"
        : "not_a_movement_session",
      actualMetMin: actualMet,
      plannedMetMin: plannedMet,
    };
  }

  // Guard: if the planned session has no target duration we can't
  // reason about MET-minute equivalence. Fall through to the caller's
  // usual duration floor.
  if (plannedMin <= 0) {
    return {
      qualifies: false,
      reason: "insufficient_effort",
      actualMetMin: actualMet,
      plannedMetMin: plannedMet,
    };
  }

  if (actualMin / plannedMin < DURATION_RATIO_FLOOR) {
    return {
      qualifies: false,
      reason: "actual_too_short",
      actualMetMin: actualMet,
      plannedMetMin: plannedMet,
    };
  }

  const ratio = actualMet / plannedMet;
  if (ratio < MET_MIN_RATIO_FLOOR) {
    return {
      qualifies: false,
      reason: "insufficient_effort",
      actualMetMin: actualMet,
      plannedMetMin: plannedMet,
    };
  }

  return {
    qualifies: true,
    reason: "movement_substitute",
    actualMetMin: actualMet,
    plannedMetMin: plannedMet,
  };
}
