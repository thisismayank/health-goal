/**
 * Pure week-1 plan preview for the cold-start verdict card.
 *
 * The visitor's biggest question at the "Get the training plan for
 * X →" moment is "what does the plan actually look like?" — a bare
 * promise doesn't convert as well as showing 3 session titles + total
 * hours ("Week 1: strength, Z2 cardio, long mountain session · 5h").
 * See Devin's pre-Reddit walk-through: "nothing shows me the plan
 * before the wall" was the biggest gap flagged.
 *
 * Deliberately no DB writes — this is called from a public server
 * action alongside assessColdStart, so it must be pure. Same math the
 * real generator uses on week 1 (weekFactor + startMultiplier); the
 * generator remains the source of truth, this file just replicates
 * the first-week output shape.
 */

import type { PlanGoalType, SessionCategory } from "@/db/schema";
import {
  defaultWeeksForGoal,
  templatesForGoal,
  type WeeklyHours,
} from "./templates";
import type { StartingFitness } from "./generator";

export type PreviewSession = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  category: SessionCategory;
  title: string;
  minutes: number;
};

export type PlanPreview = {
  sessions: PreviewSession[];
  totalMinutes: number;
  goalType: PlanGoalType;
  totalWeeks: number;
};

// Keep in sync with lib/plan/generator.ts::START_MULTIPLIER.
const START_MULTIPLIER: Record<StartingFitness, number> = {
  new: 0.6,
  occasional: 0.75,
  regular: 0.9,
  active: 1.0,
};

// Keep in sync with lib/plan/generator.ts::weekFactor for week 0
// (first calendar week of the plan). The generator's `build-in` phase
// covers frac < 0.15 → factor 0.85. Week 0 of any plan is always
// build-in, so this is a constant.
const WEEK_ONE_FACTOR = 0.85;

function normalizeMinutes(base: number, factor: number): number {
  return Math.round((base * factor) / 5) * 5;
}

export function computeWeek1Preview(input: {
  goalType: PlanGoalType;
  weeklyHours: WeeklyHours;
  startingFitness: StartingFitness;
}): PlanPreview {
  const template = templatesForGoal(input.goalType)[input.weeklyHours];
  const startMul = START_MULTIPLIER[input.startingFitness];
  const factor = WEEK_ONE_FACTOR * startMul;

  const sessions: PreviewSession[] = template.map((d) => ({
    weekday: d.weekday,
    category: d.category,
    title: d.title,
    minutes: normalizeMinutes(d.minutes, factor),
  }));
  const totalMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  return {
    sessions,
    totalMinutes,
    goalType: input.goalType,
    totalWeeks: defaultWeeksForGoal(input.goalType),
  };
}
