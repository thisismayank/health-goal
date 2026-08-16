/**
 * Fuzzy-match a workout's source name (Strava activity title, etc.) against
 * the trail library. Used by /trails/link to suggest completions for
 * historical workouts.
 *
 * Approach: pure name-based match. Token-set overlap between the workout
 * name and each trail name, boosted for containment. Deliberately
 * conservative — the goal is high-precision suggestions (few false
 * positives) rather than exhaustive recall. Users can always manually log
 * completions we miss.
 */

import { TRAIL_LIBRARY, type TrailPreset } from "@/lib/basecamp/trail-library";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "at",
  "on",
  "in",
  "of",
  "to",
  "for",
  "with",
  "via",
  "up",
  "down",
  "trail",
  "hike",
  "loop",
  "route",
  "path",
  "peak",
  "mount",
  "mt",
  "national",
  "park",
  "forest",
  "wilderness",
  "morning",
  "afternoon",
  "evening",
  "sunset",
  "sunrise",
  "day",
  "weekend",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['`’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Score a match between workout name and trail name in [0, 1].
 *   1.0  → strong containment match (workout name contains trail name)
 *   0.7+ → high token overlap, likely correct
 *   0.4+ → plausible, present with caveat
 *   <0.4 → discard
 */
export function scoreMatch(workoutName: string, trailName: string): number {
  const w = normalize(workoutName);
  const t = normalize(trailName);

  if (!w || !t) return 0;
  if (w === t) return 1.0;
  if (w.includes(t) && t.length >= 5) return 1.0;

  const wTokens = new Set(tokens(workoutName));
  const tTokens = tokens(trailName);
  if (tTokens.length === 0 || wTokens.size === 0) return 0;

  const overlap = tTokens.filter((tok) => wTokens.has(tok)).length;
  if (overlap === 0) return 0;

  const recall = overlap / tTokens.length;
  const precision = overlap / wTokens.size;
  // F1-ish combined score, biased toward recall (we care about not missing
  // the trail's name tokens more than about spurious extras like "Morning").
  return (2 * recall * precision) / (recall + precision + 0.01);
}

export type PresetMatch = {
  preset: TrailPreset;
  score: number;
};

/**
 * For a workout's source name, return the best-scoring library presets
 * above a threshold. Sorted by descending score.
 */
export function suggestPresetsForName(
  workoutName: string | null,
  opts?: { minScore?: number; maxResults?: number },
): PresetMatch[] {
  if (!workoutName) return [];
  const minScore = opts?.minScore ?? 0.55;
  const maxResults = opts?.maxResults ?? 3;

  const scored: PresetMatch[] = TRAIL_LIBRARY.map((preset) => ({
    preset,
    score: scoreMatch(workoutName, preset.name),
  })).filter((m) => m.score >= minScore);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

// Same as suggestPresetsForName but scoring against a user's saved trails
// (checked first, since a saved trail signals user intent).
export function suggestFromSavedTrails<
  T extends { id: number; name: string; presetSlug: string | null },
>(
  workoutName: string | null,
  savedTrails: T[],
  opts?: { minScore?: number; maxResults?: number },
): Array<{ trail: T; score: number }> {
  if (!workoutName) return [];
  const minScore = opts?.minScore ?? 0.55;
  const maxResults = opts?.maxResults ?? 3;

  const scored = savedTrails
    .map((t) => ({ trail: t, score: scoreMatch(workoutName, t.name) }))
    .filter((m) => m.score >= minScore);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
