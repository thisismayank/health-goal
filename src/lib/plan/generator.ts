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
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  trainingPlan,
  type SessionCategory,
} from "@/db/schema";
import { ymd } from "@/lib/date";

export type WeeklyHours = 3 | 5 | 7 | 10;
export type StartingFitness = "new" | "occasional" | "regular" | "active";

const PLAN_WEEKS = 12;

type DayTemplate = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Mon
  category: SessionCategory;
  title: string;
  minutes: number;
  rpeMin?: number;
  rpeMax?: number;
  instructions: string;
  strengthPrescription?: { name: string; sets: number; reps: string }[];
};

const LOWER_STRENGTH_PRESCRIPTION = [
  { name: "Goblet squat", sets: 3, reps: "10" },
  { name: "Walking lunges", sets: 3, reps: "10/leg" },
  { name: "Step-ups", sets: 3, reps: "10/leg" },
  { name: "Single-leg RDL", sets: 2, reps: "8/leg" },
  { name: "Calf raises", sets: 3, reps: "15" },
];
const UPPER_STRENGTH_PRESCRIPTION = [
  { name: "Push-ups (or bench press)", sets: 3, reps: "8-12" },
  { name: "Pull-ups (or lat pulldown)", sets: 3, reps: "6-10" },
  { name: "Overhead press", sets: 3, reps: "8-10" },
  { name: "Row (barbell or dumbbell)", sets: 3, reps: "10" },
  { name: "Plank hold", sets: 3, reps: "30-45s" },
];
const FULL_BODY_STRENGTH_PRESCRIPTION = [
  { name: "Squat", sets: 3, reps: "10" },
  { name: "Deadlift or hinge", sets: 3, reps: "8" },
  { name: "Push-up or bench", sets: 3, reps: "10" },
  { name: "Row", sets: 3, reps: "10" },
  { name: "Plank", sets: 3, reps: "30-45s" },
];
const MOUNTAIN_LEGS_PRESCRIPTION = [
  { name: "Walking lunges", sets: 3, reps: "12/leg" },
  { name: "Step-ups", sets: 3, reps: "12/leg" },
  { name: "Bulgarian split squat", sets: 3, reps: "10/leg" },
  { name: "Calf raises", sets: 3, reps: "15" },
  { name: "Hip hinges", sets: 2, reps: "12" },
];

// Weekly templates keyed by hours-per-week. Each week of the plan uses
// the same shape; we just scale volume via a per-week factor below.
const TEMPLATES: Record<WeeklyHours, DayTemplate[]> = {
  3: [
    {
      weekday: 0,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "Warm-up: 5 min easy cardio + dynamic stretch (leg swings, arm circles).\n\nMain: 3 rounds of the prescribed circuit, ~45s rest between exercises. Focus on form over weight.\n\nCool-down: 5 min walk + light stretch (hamstrings, hips).",
      strengthPrescription: FULL_BODY_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 2,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "Warm-up: 5 min easy pace, gradual build.\n\nMain: 35 min at conversational Zone 2 (can talk in full sentences, breathing controlled). Any modality — bike, jog, hike, StairMaster, incline treadmill.\n\nCool-down: 5 min easy pace + light stretch.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 60,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Sustained uphill-oriented aerobic work. Mix incline treadmill, StairMaster, or outdoor hiking. Steady effort throughout — no need to push pace. Focus is time on feet + vertical.",
    },
  ],
  5: [
    {
      weekday: 0,
      category: "LOWER_STRENGTH",
      title: "Lower Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 8,
      instructions:
        "Warm-up: 5 min bike or easy cardio + dynamic mobility.\n\nMain: work through the prescribed sets. Progressive overload — a bit more weight or reps than last week if last week felt easy.\n\nCool-down: 5 min walk + stretch quads, hamstrings, hips.",
      strengthPrescription: LOWER_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 2,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "Warm-up: 5 min walk into an easy jog.\n\nMain: 30 min at conversational pace. If you can't hold a conversation, slow down. If you're not sure about pace, aim to feel like you could go 2× as long.\n\nCool-down: 5 min walk + light stretch.",
    },
    {
      weekday: 4,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "Warm-up: 5 min dynamic warm-up.\n\nMain: 3 rounds of the prescribed exercises. Rest ~60s between rounds.\n\nCool-down: 5 min stretch — chest, back, shoulders.",
      strengthPrescription: FULL_BODY_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 90,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Uphill-focused endurance. Outdoor hike preferred — otherwise incline treadmill @ 12%+ or StairMaster. Aim for time on feet at Zone 2. Fuel + hydrate mid-session.",
    },
  ],
  7: [
    {
      weekday: 0,
      category: "LOWER_STRENGTH",
      title: "Lower Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 8,
      instructions:
        "Warm-up: 5 min bike + hip openers.\n\nMain: prescribed sets. Push weight this week if last week's felt manageable.\n\nCool-down: 5 min light spin + stretch.",
      strengthPrescription: LOWER_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 1,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "5 min warm-up walk/jog. 35 min conversational pace. 5 min cool-down walk + stretch.",
    },
    {
      weekday: 2,
      category: "UPPER_STRENGTH",
      title: "Upper Body Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "Warm-up: 5 min band pull-aparts + arm circles.\n\nMain: prescribed sets — controlled tempo, full range of motion.\n\nCool-down: 5 min stretch.",
      strengthPrescription: UPPER_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 4,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "45 min at conversational pace. Any modality. Focus on aerobic capacity, not intensity.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 120,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Marquee session of the week. Outdoor hike with vertical if possible. Otherwise incline treadmill @ 15% or StairMaster continuous. Fuel + hydrate. Add pack weight (5-15 lb) if you're prepping for a specific trip.",
    },
  ],
  10: [
    {
      weekday: 0,
      category: "LOWER_STRENGTH",
      title: "Lower Body Strength",
      minutes: 45,
      rpeMin: 7,
      rpeMax: 8,
      instructions:
        "Warm-up: 5 min bike + hip openers + banded lateral walks.\n\nMain: heavier work — 4-6 reps at higher weight if you're comfortable. Focus on squat + hinge patterns.\n\nCool-down: 5 min stretch.",
      strengthPrescription: LOWER_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 1,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "5 min warm-up. 35 min conversational. 5 min cool-down. Nothing hard.",
    },
    {
      weekday: 2,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 60,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "60 min sustained Zone 2. Aerobic base building — keep breathing controlled the whole time.",
    },
    {
      weekday: 3,
      category: "UPPER_STRENGTH",
      title: "Upper Body Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 8,
      instructions:
        "Warm-up: 5 min band pull-aparts. Main: prescribed sets. Cool-down: 5 min stretch.",
      strengthPrescription: UPPER_STRENGTH_PRESCRIPTION,
    },
    {
      weekday: 4,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "Shakeout run. Very easy — this is recovery-adjacent. Keep it under 5 RPE.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 180,
      rpeMin: 4,
      rpeMax: 6,
      instructions:
        "Big day. Outdoor hike with real vertical + pack if possible (10-20 lb). Otherwise treadmill/StairMaster combo. Fuel every 45 min, hydrate every 20-30. Time on feet is the goal.",
    },
  ],
};

// Volume scaling by starting fitness — how hard we ramp week 1.
const START_MULTIPLIER: Record<StartingFitness, number> = {
  new: 0.6,
  occasional: 0.75,
  regular: 0.9,
  active: 1.0,
};

// Progressive weekly volume factor. Weeks 1-2 easier, 3-4 building,
// 5-8 peak, 9-10 slight uptick, 11 taper, 12 recovery.
function weekFactor(weekIndex: number): number {
  if (weekIndex < 2) return 0.85;
  if (weekIndex < 4) return 0.95;
  if (weekIndex < 8) return 1.0;
  if (weekIndex < 10) return 1.05;
  if (weekIndex === 10) return 0.8; // taper
  return 0.6; // recovery week
}

function normalizeMinutes(base: number, factor: number): number {
  // Round to nearest 5 min for readability.
  return Math.round((base * factor) / 5) * 5;
}

export type GeneratePlanInput = {
  userId: number;
  weeklyHours: WeeklyHours;
  startingFitness: StartingFitness;
  planName?: string;
  goalEvent?: string;
};

/**
 * Idempotent: if the user already has an ACTIVE plan, we do nothing.
 * (Later we can add regenerate-with-confirm.)
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

  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 7 * PLAN_WEEKS);

  const [plan] = await db
    .insert(trainingPlan)
    .values({
      userId: input.userId,
      name: input.planName ?? "12-Week Base Plan",
      goalEvent: input.goalEvent ?? "General mountain fitness",
      startDate: ymd(startDate),
      eventDate: ymd(endDate),
      currentPhase: 1,
      status: "active",
    })
    .returning();

  const template = TEMPLATES[input.weeklyHours];
  const startMul = START_MULTIPLIER[input.startingFitness];

  const inserts: (typeof plannedSession.$inferInsert)[] = [];

  for (let w = 0; w < PLAN_WEEKS; w++) {
    const weekMul = weekFactor(w) * startMul;
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
