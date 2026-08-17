/**
 * Plan generator — turns onboarding constraints into a 12-week training
 * plan of plannedSession rows. Called once at signup finish; users
 * without a plan get one that fits their time budget + starting fitness.
 *
 * Kept deterministic + template-based for MVP. Later we can layer in
 * LLM adjustments, benchmark-workout calibration, and specific-hike
 * targeting.
 */

import { addDays, startOfWeek } from "date-fns";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  trainingPlan,
  userProfile,
  workout,
  type PlanGoalType,
  type SessionCategory,
} from "@/db/schema";
import { ymd } from "@/lib/date";
import { suggestStartingFitness } from "./fitness-suggest";
import {
  defaultWeeksForGoal,
  templatesForGoal,
  type DayTemplate,
  type WeeklyHours as WeeklyHoursT,
} from "./templates";

export type WeeklyHours = WeeklyHoursT;
export type StartingFitness = "new" | "occasional" | "regular" | "active";

// Volume scaling by starting fitness — how hard we ramp week 1.
const START_MULTIPLIER: Record<StartingFitness, number> = {
  new: 0.6,
  occasional: 0.75,
  regular: 0.9,
  active: 1.0,
};

/**
 * Progressive weekly volume factor, phase-aware so plans of any length
 * ramp sensibly. Splits the plan into 4 phases regardless of total
 * weeks: build-in (first 15%), build (next 40%), peak (next 30%),
 * taper (final 15%). Values are 0.6–1.05 multipliers on base template
 * minutes.
 */
function weekFactor(weekIndex: number, totalWeeks: number): number {
  const frac = weekIndex / Math.max(1, totalWeeks - 1);
  if (frac < 0.15) return 0.85; // build-in
  if (frac < 0.55) return 0.95 + (frac - 0.15) * 0.125; // 0.95 → 1.0
  if (frac < 0.85) return 1.05; // peak
  if (frac < 0.95) return 0.8; // taper
  return 0.6; // recovery / event week
}

function normalizeMinutes(base: number, factor: number): number {
  // Round to nearest 5 min for readability.
  return Math.round((base * factor) / 5) * 5;
}

export type GeneratePlanInput = {
  userId: number;
  weeklyHours: WeeklyHours;
  startingFitness: StartingFitness;
  goalType?: PlanGoalType;
  planName?: string;
  goalEvent?: string;
  // Override the default plan length. Otherwise defaultWeeksForGoal
  // picks 8-40 based on the goal type.
  weeks?: number;
};

/**
 * Idempotent: if the user already has an ACTIVE plan, we do nothing.
 */
export async function generateUserPlan(
  input: GeneratePlanInput,
): Promise<{ planId: number; created: boolean; sessions: number }> {
  const existing = await db
    .select({ id: trainingPlan.id })
    .from(trainingPlan)
    .where(
      and(
        eq(trainingPlan.userId, input.userId),
        eq(trainingPlan.status, "active"),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { planId: existing[0].id, created: false, sessions: 0 };
  }

  const goalType: PlanGoalType = input.goalType ?? "mountain_summit";
  const totalWeeks = input.weeks ?? defaultWeeksForGoal(goalType);

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 7 * totalWeeks);

  const [plan] = await db
    .insert(trainingPlan)
    .values({
      userId: input.userId,
      name: input.planName ?? `${totalWeeks}-Week Plan`,
      goalEvent: input.goalEvent ?? null,
      goalType,
      source: "generated",
      startDate: ymd(startDate),
      eventDate: ymd(endDate),
      currentPhase: 1,
      status: "active",
    })
    .returning();

  const template = templatesForGoal(goalType)[input.weeklyHours];
  const startMul = START_MULTIPLIER[input.startingFitness];

  const inserts: (typeof plannedSession.$inferInsert)[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekMul = weekFactor(w, totalWeeks) * startMul;
    for (const d of template) {
      const date = ymd(addDays(startDate, w * 7 + d.weekday));
      const minutes = normalizeMinutes(d.minutes, weekMul);
      inserts.push({
        planId: plan.id,
        date,
        sessionCategory: d.category,
        title: d.title,
        targetDurationMinutes: minutes,
        targetRpeMin: d.rpeMin ?? null,
        targetRpeMax: d.rpeMax ?? null,
        targetPackWeightLb: null,
        targetElevationGainFt: null,
        instructions: d.instructions,
        strengthPrescription: d.strengthPrescription
          ? JSON.stringify(d.strengthPrescription)
          : null,
        status: "planned",
      });
    }
  }

  await db.insert(plannedSession).values(inserts);
  return { planId: plan.id, created: true, sessions: inserts.length };
}

export type RefreshResult =
  | { refreshed: true; from: StartingFitness | null; to: StartingFitness }
  | {
      refreshed: false;
      reason:
        | "no_constraints"
        | "no_plan"
        | "has_completions"
        | "no_suggestion"
        | "no_change";
    };

/**
 * Refresh a user's plan if their newly-observed fitness (from imported
 * activity data) contradicts the class they picked at onboarding.
 *
 * Safety guards — all must pass or we no-op:
 *   1. User has weeklyTrainingHours (was onboarded with a plan)
 *   2. Active plan exists
 *   3. Zero workouts are linked to any of the plan's sessions — once the
 *      user has started their plan, we don't rewrite it out from under them
 *   4. Suggestion is available AND differs from stored fitness
 *
 * Called from Strava OAuth callback + settings "Sync now" so a user who
 * skipped Strava during onboarding still gets a data-informed plan the
 * moment their history arrives.
 */
export async function refreshPlanIfEligible(
  userId: number,
): Promise<RefreshResult> {
  const [profile] = await db
    .select({
      weeklyHours: userProfile.weeklyTrainingHours,
      fitness: userProfile.startingFitness,
    })
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);
  if (!profile?.weeklyHours) {
    return { refreshed: false, reason: "no_constraints" };
  }

  const [plan] = await db
    .select({ id: trainingPlan.id })
    .from(trainingPlan)
    .where(
      and(
        eq(trainingPlan.userId, userId),
        eq(trainingPlan.status, "active"),
      ),
    )
    .limit(1);
  if (!plan) return { refreshed: false, reason: "no_plan" };

  const [firstLinked] = await db
    .select({ id: workout.id })
    .from(workout)
    .innerJoin(plannedSession, eq(workout.plannedSessionId, plannedSession.id))
    .where(
      and(
        eq(workout.userId, userId),
        eq(plannedSession.planId, plan.id),
        isNotNull(workout.plannedSessionId),
      ),
    )
    .limit(1);
  if (firstLinked) return { refreshed: false, reason: "has_completions" };

  const suggested = await suggestStartingFitness(userId);
  if (!suggested) return { refreshed: false, reason: "no_suggestion" };
  const current = profile.fitness as StartingFitness | null;
  if (current === suggested) return { refreshed: false, reason: "no_change" };

  // Wipe the old plan + regenerate with the new fitness class. Ordered
  // so we never orphan sessions if the plan delete succeeds but the
  // regenerate fails: sessions first, then plan, then regenerate.
  await db.delete(plannedSession).where(eq(plannedSession.planId, plan.id));
  await db.delete(trainingPlan).where(eq(trainingPlan.id, plan.id));
  await db
    .update(userProfile)
    .set({ startingFitness: suggested, updatedAt: new Date() })
    .where(eq(userProfile.id, userId));
  await generateUserPlan({
    userId,
    weeklyHours: profile.weeklyHours as WeeklyHours,
    startingFitness: suggested,
  });

  return { refreshed: true, from: current, to: suggested };
}
