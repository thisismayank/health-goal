/**
 * Injury-aware session adaptation.
 *
 * Product intent: when a user has an active knee/back/etc. injury
 * logged, prescribed sessions that would aggravate it get
 * downgraded, swapped, or replaced. Rules are conservative — err
 * on the side of skipping something loaded rather than pushing
 * through — and they compose (multiple injuries → the most
 * restrictive adaptation wins per session).
 *
 * Contract:
 *   adaptSession(session, injuries) returns:
 *     { kind: 'keep' } — no conflict, session unchanged
 *     { kind: 'downgrade', targetIntensity, note } — same modality,
 *       less load / effort
 *     { kind: 'swap', newCategory, note } — different modality entirely
 *     { kind: 'skip', note } — replace with mobility/recovery
 *
 * Deliberately not persisting the adapted version: this runs on read
 * so resolving the injury (setting endDate) immediately restores the
 * original prescription without having to re-generate the plan.
 */

import type { InjuryRegion, InjurySeverity, SessionCategory } from "@/db/schema";

export type ActiveInjury = {
  region: InjuryRegion;
  severity: InjurySeverity;
  notes: string | null;
};

export type AdaptationResult =
  | { kind: "keep" }
  | {
      kind: "downgrade";
      note: string;
      // Optional multiplier for target volume (e.g., 0.6 = cut by 40%).
      volumeMultiplier?: number;
    }
  | {
      kind: "swap";
      newCategory: SessionCategory;
      note: string;
    }
  | {
      kind: "skip";
      note: string; // what to do instead
    };

// Category → set of regions that conflict with it. Order-of-magnitude
// mapping; specific mechanics are in adaptSession below.
const CONFLICT_MAP: Record<SessionCategory, InjuryRegion[]> = {
  EASY_RUN: ["knee", "ankle", "hip"],
  QUALITY_RUN: ["knee", "ankle", "hip", "back"],
  ZONE2_CARDIO: [], // bike / erg — low impact, generally fine
  UPPER_STRENGTH: ["shoulder"],
  LOWER_STRENGTH: ["knee", "back", "hip"],
  FULL_BODY_STRENGTH: ["knee", "back", "shoulder", "hip"],
  MOUNTAIN_LEGS: ["knee", "back", "hip"],
  STAIRMASTER: ["knee", "hip"],
  INCLINE_TREADMILL: ["knee", "hip", "back"],
  OUTDOOR_HIKE: ["knee", "ankle", "back"],
  LOADED_HIKE: ["knee", "back", "hip", "shoulder"],
  LONG_MOUNTAIN_SESSION: ["knee", "back", "hip"],
  ACTIVE_RECOVERY: [],
  MOBILITY: [],
  CROSS_TRAINING: [],
  REST: [],
  UNKNOWN: [],
};

export function adaptSession(
  category: SessionCategory,
  injuries: ActiveInjury[],
): AdaptationResult {
  if (injuries.length === 0) return { kind: "keep" };

  const conflicts = injuries.filter((i) =>
    CONFLICT_MAP[category].includes(i.region),
  );
  if (conflicts.length === 0) return { kind: "keep" };

  // Pick the most restrictive injury for this session.
  const worst = conflicts.reduce<ActiveInjury>((max, cur) => {
    const rank = (s: InjurySeverity) =>
      s === "recovering" ? 2 : s === "moderate" ? 1 : 0;
    return rank(cur.severity) > rank(max.severity) ? cur : max;
  }, conflicts[0]);

  const regionLabel = worst.region;
  const noteSuffix = worst.notes ? ` (${worst.notes})` : "";

  // Recovering: skip anything conflicting.
  if (worst.severity === "recovering") {
    return {
      kind: "skip",
      note: `Skip — you're recovering from ${regionLabel}${noteSuffix}. Do 20-30 min of mobility instead.`,
    };
  }

  // Moderate: swap modality where possible.
  if (worst.severity === "moderate") {
    if (category === "EASY_RUN" || category === "QUALITY_RUN") {
      return {
        kind: "swap",
        newCategory: "ZONE2_CARDIO",
        note: `Swap running for cycling/rowing — same aerobic dose, no ${regionLabel} impact${noteSuffix}.`,
      };
    }
    if (category === "LOADED_HIKE") {
      return {
        kind: "swap",
        newCategory: "OUTDOOR_HIKE",
        note: `Drop the pack — hike unloaded until ${regionLabel} settles${noteSuffix}.`,
      };
    }
    if (category === "LOWER_STRENGTH" || category === "MOUNTAIN_LEGS") {
      return worst.region === "shoulder"
        ? { kind: "keep" } // shouldn't apply — filter above should have excluded
        : {
            kind: "swap",
            newCategory: "UPPER_STRENGTH",
            note: `Swap for upper-body strength — leave ${regionLabel} alone${noteSuffix}.`,
          };
    }
    if (category === "FULL_BODY_STRENGTH") {
      return {
        kind: "swap",
        newCategory:
          worst.region === "shoulder" ? "LOWER_STRENGTH" : "UPPER_STRENGTH",
        note: `Split strength into just ${worst.region === "shoulder" ? "lower body" : "upper body"} today — avoid ${regionLabel}${noteSuffix}.`,
      };
    }
    if (category === "STAIRMASTER" || category === "INCLINE_TREADMILL") {
      return {
        kind: "swap",
        newCategory: "ZONE2_CARDIO",
        note: `Swap incline for flat cardio — reduces ${regionLabel} load${noteSuffix}.`,
      };
    }
    // Fall through for anything not explicitly handled: skip.
    return {
      kind: "skip",
      note: `Skip — modality conflicts with ${regionLabel}${noteSuffix}. Mobility + easy walk instead.`,
    };
  }

  // Light: keep modality, downgrade volume.
  return {
    kind: "downgrade",
    volumeMultiplier: 0.6,
    note: `Cut volume ~40% — ${regionLabel} still tender${noteSuffix}. Same session, lighter dose.`,
  };
}

// Convenience: does the user have ANY active injury that conflicts
// with this category? Used for chip rendering without needing the
// full adaptation shape.
export function categoryHasConflict(
  category: SessionCategory,
  injuries: ActiveInjury[],
): boolean {
  const conflicts = CONFLICT_MAP[category];
  return injuries.some((i) => conflicts.includes(i.region));
}
