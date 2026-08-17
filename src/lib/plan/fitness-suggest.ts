/**
 * Suggests a starting fitness class based on the user's recent activity
 * history. Called from the onboarding plan step when Strava (or any
 * other source) has already synced enough data to make a guess.
 *
 * Thresholds are calibrated to the four options users see on the wizard:
 *   new         — barely any training (<4 sessions / 30d)
 *   occasional  — training here and there (4-11 / 30d)
 *   regular     — most weeks, ~3x (12-19 / 30d)
 *   active      — consistent hard training (≥20 / 30d)
 *
 * Returns null when there's not enough data to guess — the caller
 * should fall back to asking the user directly.
 */

import { and, gte, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workout } from "@/db/schema";

export type StartingFitness = "new" | "occasional" | "regular" | "active";

const WINDOW_DAYS = 30;

export async function suggestStartingFitness(
  userId: number,
): Promise<StartingFitness | null> {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000);
  const rows = await db
    .select({ id: workout.id })
    .from(workout)
    .where(and(eq(workout.userId, userId), gte(workout.startTime, cutoff)));
  const count = rows.length;
  if (count === 0) return null;
  if (count < 4) return "new";
  if (count < 12) return "occasional";
  if (count < 20) return "regular";
  return "active";
}
