import type { Rank } from "./rank";

/**
 * Personal time estimate for a trail — scales the guidebook "typical"
 * hours by the hiker's fitness class. Guidebook times are calibrated
 * for a Class C "Regular Hiker" (steady moving pace, few extended
 * breaks). Slower classes take longer; stronger classes run through it.
 *
 * Multipliers are directional not clinical — good enough to give a
 * useful gut-check ("this feels like a 5h day for me, not 3.5h").
 * If we ever build a real pace model from Strava data we can replace
 * these with a per-user regression.
 */
const RANK_MULTIPLIER: Record<Rank, number> = {
  E: 1.4, // Casual Walker — noticeable rest breaks, cautious pace
  D: 1.2, // Weekend Hiker
  C: 1.0, // Regular Hiker (baseline)
  B: 0.9, // Serious Hiker — steady climber
  A: 0.85, // Mountain Athlete
  S: 0.8, // Alpinist — efficient on trail
};

export function estimatePersonalHours(
  typicalHours: number,
  rank: Rank,
): number {
  return typicalHours * RANK_MULTIPLIER[rank];
}

/**
 * Round to a friendly display. Under 1h shows minutes; over 1h shows
 * one decimal (e.g. 4.2h). Above 8h rounds to the half.
 */
export function formatHoursCasual(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h > 8) return `${Math.round(h * 2) / 2}h`;
  const rounded = Math.round(h * 10) / 10;
  return `${rounded}h`;
}
