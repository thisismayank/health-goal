/**
 * Derives an objective 'minimum Hiker Class' for each preset trail so we
 * can show LOCKED / at-class chips on discovery results. Combines
 * terrain grade + altitude + multi-day nature.
 *
 * Objective difficulty ≠ personal fit. A user at Class D might have a
 * READY verdict on a Class C trail because their fitness happens to
 * carry them past the deterministic engine's thresholds. The chip
 * tells them 'this is a Class C objective' regardless.
 */

import type { TrailPreset } from "./trail-library";
import { RANKS, type Rank } from "./rank";

function isMultiDay(notes: string): boolean {
  const n = notes.toLowerCase();
  return (
    /\b(day trek|day expedition|thru-?hike|circumnavigation|expedition)\b/.test(
      n,
    ) || /(6|7|8|9|10|11|12|13|14|15|18|20|21|24)[- ]day/.test(n)
  );
}

function bumpRank(r: Rank, steps: number): Rank {
  const i = RANKS.indexOf(r);
  const next = Math.min(RANKS.length - 1, i + steps);
  return RANKS[next];
}

export function minClassForPreset(preset: TrailPreset): Rank {
  let base: Rank;
  switch (preset.terrainGrade) {
    case "easy":
      base = "D";
      break;
    case "moderate":
      base = "C";
      break;
    case "technical":
      base = "B";
      break;
    case "mountaineering":
      base = "A";
      break;
    default:
      base = "C";
  }

  // Altitude ratchets — real thin-air physiology overrides terrain grade.
  const alt = preset.maxAltitudeFt;
  if (alt >= 20000) return "S";
  if (alt >= 18000) return maxRank(base, "A");
  if (alt >= 14000) return maxRank(base, "B");

  // Multi-day bumps difficulty by one class (sustained load, camp logistics,
  // no bail-out) — capped at S.
  if (isMultiDay(preset.notes)) {
    return bumpRank(base, 1);
  }

  return base;
}

function maxRank(a: Rank, b: Rank): Rank {
  return RANKS.indexOf(a) > RANKS.indexOf(b) ? a : b;
}

export function isLocked(userClass: Rank, requiredClass: Rank): boolean {
  return RANKS.indexOf(userClass) < RANKS.indexOf(requiredClass);
}
