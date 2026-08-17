/**
 * Sentence generators that turn raw home-page state into the human
 * voice we want on the redesigned home. Pure functions — no DB,
 * no side effects — so they're easy to test + swap out later when
 * we add the LLM coach layer.
 */

import type { PlannedSession } from "@/db/schema";
import type { CharacterSheet } from "@/lib/basecamp/stats";
import type { ActiveGoal } from "@/lib/basecamp/summit";
import type { Rank, RankResult } from "@/lib/basecamp/rank";

// -------- Greeting --------

export function greetingFor(name: string, nowHour: number): string {
  const first = name.split(" ")[0];
  if (nowHour < 5) return `Still up, ${first}?`;
  if (nowHour < 12) return `${first}, morning`;
  if (nowHour < 17) return `${first}, afternoon`;
  if (nowHour < 21) return `${first}, evening`;
  return `${first}, late one`;
}

// -------- North-star framing --------

export type UpcomingBeat = {
  kind: "trip" | "north_star";
  label: string; // "Skyline hike" / "Rainier base camp"
  daysAway: number;
};

/**
 * Build the "6 days until X. 40 days until Y." line at the top of home.
 * Passes back 0, 1, or 2 sentences — never more, to keep the fold clean.
 */
export function northStarBeats(input: {
  nextTripName: string | null;
  nextTripDaysAway: number | null;
  northStarName: string | null;
  northStarDaysAway: number | null;
}): string[] {
  const out: string[] = [];
  if (input.nextTripName && input.nextTripDaysAway != null) {
    out.push(
      `${input.nextTripDaysAway === 0 ? "Today" : `${input.nextTripDaysAway} day${input.nextTripDaysAway === 1 ? "" : "s"}`} until your ${input.nextTripName}.`,
    );
  }
  if (
    input.northStarName &&
    input.northStarDaysAway != null &&
    // Don't duplicate if the next trip IS the north star.
    (input.northStarName !== input.nextTripName ||
      input.northStarDaysAway !== input.nextTripDaysAway)
  ) {
    out.push(
      `${input.northStarDaysAway === 0 ? "Today" : `${input.northStarDaysAway} day${input.northStarDaysAway === 1 ? "" : "s"}`} until ${input.northStarName}.`,
    );
  }
  return out;
}

// -------- Today's workout: "why this workout" --------

/**
 * One-line context telling the user WHY today's session exists,
 * relative to their north-star goal. Falls back to a generic
 * description when we can't infer specific transfer.
 */
export function whyThisWorkout(
  session: PlannedSession,
  goalName: string | null,
): string {
  const goalStr = goalName ?? "your objective";
  const cat = session.sessionCategory;
  if (cat === "UPPER_STRENGTH") {
    return `Builds the shoulders + core that carry a loaded pack toward ${goalStr}.`;
  }
  if (cat === "LOWER_STRENGTH" || cat === "MOUNTAIN_LEGS") {
    return `Builds the legs that climb the vertical for ${goalStr}.`;
  }
  if (cat === "FULL_BODY_STRENGTH") {
    return `General strength — the base that all the mountain work sits on.`;
  }
  if (cat === "LONG_MOUNTAIN_SESSION" || cat === "LOADED_HIKE") {
    return `Time on feet, at effort — the closest specific prep for ${goalStr}.`;
  }
  if (cat === "ZONE2_CARDIO" || cat === "EASY_RUN") {
    return `Aerobic base — the engine your climb pace runs on.`;
  }
  if (cat === "QUALITY_RUN") {
    return `Sharpens the top end so long climbs feel easier.`;
  }
  if (cat === "STAIRMASTER" || cat === "INCLINE_TREADMILL") {
    return `Vertical-specific — closest indoor stand-in for real climbing.`;
  }
  if (cat === "ACTIVE_RECOVERY" || cat === "REST" || cat === "MOBILITY") {
    return `Recovery day. Adaptation happens when you're not lifting.`;
  }
  return `Sized to keep you consistent without over-reaching.`;
}

// -------- Recovery narrative --------

export function recoveryLine(sheet: CharacterSheet): string {
  const rec = sheet.stats.REC;
  // Don't push based on a partial signal. If sleep/HRV/RHR aren't
  // both present today, say so instead of confidently telling the
  // user to push.
  if (!rec.hasEnoughData) {
    return `Recovery signal is thin today — listen to how you feel in the warm-up rep and let that be the read.`;
  }
  const value = rec.value;
  if (value >= 85) return `You're fresh today. Recovery is high — push the sets.`;
  if (value >= 65) return `Solid recovery. Hit the plan as prescribed.`;
  if (value >= 45) return `Moderate recovery. Aim for form + consistency, not PRs.`;
  if (value >= 25) return `Recovery is low. Take a warm-up rep to feel it out — pull back if it's off.`;
  return `Recovery is red. Consider an easy day or a full rest — the plan doesn't care about one moved day.`;
}

// -------- Progress toward next class --------

export function classProgressLine(rank: RankResult): string {
  if (!rank.nextRank) return `You're at Class ${rank.current} — the top of the ladder.`;
  const pct = rank.progressPct;
  const nextLabel = classShort(rank.nextRank);
  if (pct >= 85) return `You're on the edge of Class ${rank.nextRank} — ${nextLabel}. One more solid week does it.`;
  if (pct >= 60) return `More than halfway to Class ${rank.nextRank} — ${nextLabel}.`;
  if (pct >= 30) return `A third into your climb toward Class ${rank.nextRank}.`;
  return `Just started building toward Class ${rank.nextRank} — ${nextLabel}.`;
}

function classShort(rank: Rank): string {
  switch (rank) {
    case "E":
      return "Casual Walker";
    case "D":
      return "Weekend Hiker";
    case "C":
      return "Regular Hiker";
    case "B":
      return "Serious Hiker";
    case "A":
      return "Mountain Athlete";
    case "S":
      return "Alpinist";
  }
}
