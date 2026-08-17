/**
 * Goal-type-specific weekly session templates. Extracted from the
 * mountain-summit-only generator.ts so we can dispatch cleanly on
 * PlanGoalType and add more goal families without a mega-file.
 *
 * Each template is a weekly shape: a list of days with a category,
 * title, duration, and optional RPE band + strength prescription.
 * The generator applies weekly progression + starting-fitness scaling
 * on top uniformly, so template code stays declarative.
 */

import type { PlanGoalType, SessionCategory } from "@/db/schema";

export type DayTemplate = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Mon
  category: SessionCategory;
  title: string;
  minutes: number;
  rpeMin?: number;
  rpeMax?: number;
  instructions: string;
  strengthPrescription?: { name: string; sets: number; reps: string }[];
};

export type WeeklyHours = 3 | 5 | 7 | 10;

// Shared strength prescription sets (kept identical to the original
// mountain generator so existing weeks look familiar to Mayank).
const LOWER = [
  { name: "Goblet squat", sets: 3, reps: "10" },
  { name: "Walking lunges", sets: 3, reps: "10/leg" },
  { name: "Step-ups", sets: 3, reps: "10/leg" },
  { name: "Single-leg RDL", sets: 2, reps: "8/leg" },
  { name: "Calf raises", sets: 3, reps: "15" },
];
const UPPER = [
  { name: "Push-ups (or bench press)", sets: 3, reps: "8-12" },
  { name: "Pull-ups (or lat pulldown)", sets: 3, reps: "6-10" },
  { name: "Overhead press", sets: 3, reps: "8-10" },
  { name: "Row (barbell or dumbbell)", sets: 3, reps: "10" },
  { name: "Plank hold", sets: 3, reps: "30-45s" },
];
const FULL_BODY = [
  { name: "Squat", sets: 3, reps: "10" },
  { name: "Deadlift or hinge", sets: 3, reps: "8" },
  { name: "Push-up or bench", sets: 3, reps: "10" },
  { name: "Row", sets: 3, reps: "10" },
  { name: "Plank", sets: 3, reps: "30-45s" },
];

// ────── MOUNTAIN SUMMIT (existing behavior, preserved) ──────
const MOUNTAIN_SUMMIT: Record<WeeklyHours, DayTemplate[]> = {
  3: [
    {
      weekday: 0,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "Warm-up: 5 min easy cardio + dynamic stretch.\n\nMain: 3 rounds of the prescribed circuit, ~45s rest between exercises. Focus on form over weight.\n\nCool-down: 5 min walk + light stretch.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 2,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions:
        "35 min at conversational Zone 2 pace. Any modality — bike, jog, hike, StairMaster.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 60,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Sustained uphill-oriented aerobic work. Steady effort throughout. Focus is time on feet + vertical.",
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
        "Warm-up 5 min. Prescribed sets, progressive overload. Cool-down 5 min + stretch.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 2,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "30 min conversational pace. If you can't talk, slow down.",
    },
    {
      weekday: 4,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "3 rounds of the circuit. Rest ~60s between rounds.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 90,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Uphill-focused endurance. Outdoor hike or incline treadmill @ 12%+. Fuel + hydrate mid-session.",
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
      instructions: "Prescribed sets. Push weight this week if last week felt manageable.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 1,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "35 min conversational pace.",
    },
    {
      weekday: 2,
      category: "UPPER_STRENGTH",
      title: "Upper Body Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "Prescribed sets, controlled tempo, full range of motion.",
      strengthPrescription: UPPER,
    },
    {
      weekday: 4,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "45 min at conversational pace. Any modality.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 120,
      rpeMin: 4,
      rpeMax: 5,
      instructions:
        "Marquee session. Outdoor hike with vertical if possible. Add pack weight (5-15 lb) if prepping for a specific trip.",
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
      instructions: "Heavier work — 4-6 reps at higher weight. Focus on squat + hinge patterns.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 1,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "35 min conversational.",
    },
    {
      weekday: 2,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 60,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "60 min sustained Zone 2. Aerobic base building.",
    },
    {
      weekday: 3,
      category: "UPPER_STRENGTH",
      title: "Upper Body Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 8,
      instructions: "Prescribed sets. Cool-down + stretch.",
      strengthPrescription: UPPER,
    },
    {
      weekday: 4,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Shakeout run. Under 5 RPE.",
    },
    {
      weekday: 5,
      category: "LONG_MOUNTAIN_SESSION",
      title: "Long Mountain Session",
      minutes: 180,
      rpeMin: 4,
      rpeMax: 6,
      instructions:
        "Big day. Outdoor hike with real vertical + pack (10-20 lb). Fuel every 45 min, hydrate every 20-30.",
    },
  ],
};

// ────── RACE 5K (running-focused, higher-intensity option) ──────
// Volume calibrated to what a couch-to-5k → intermediate 5k plan looks
// like. Long run is capped at ~10 km even at high hours because 5k
// prep doesn't reward marathon-style volume.
const RACE_5K: Record<WeeklyHours, DayTemplate[]> = {
  3: [
    {
      weekday: 1,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Conversational pace. All aerobic base.",
    },
    {
      weekday: 3,
      category: "QUALITY_RUN",
      title: "Intervals",
      minutes: 30,
      rpeMin: 7,
      rpeMax: 8,
      instructions:
        "10 min warm-up. Main: 5 × 400m at target 5k pace, 2 min jog between. 5 min cool-down.",
    },
    {
      weekday: 5,
      category: "EASY_RUN",
      title: "Long Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Slow, sustainable pace. Longest of the week — build to 6-8 km.",
    },
  ],
  5: [
    {
      weekday: 0,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Conversational aerobic run.",
    },
    {
      weekday: 1,
      category: "FULL_BODY_STRENGTH",
      title: "Runner Strength",
      minutes: 30,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "3 rounds of the circuit. Focus on hips, glutes, core.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 2,
      category: "QUALITY_RUN",
      title: "Intervals",
      minutes: 35,
      rpeMin: 7,
      rpeMax: 8,
      instructions:
        "10 min warm-up. Main: 6 × 400m at 5k pace, 90s jog between. 5 min cool-down.",
    },
    {
      weekday: 4,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Conversational, no pushing.",
    },
    {
      weekday: 5,
      category: "EASY_RUN",
      title: "Long Easy Run",
      minutes: 60,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Slow, sustainable — build to 8-10 km.",
    },
  ],
  7: [
    {
      weekday: 0,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Aerobic base.",
    },
    {
      weekday: 1,
      category: "LOWER_STRENGTH",
      title: "Lower Strength",
      minutes: 35,
      rpeMin: 6,
      rpeMax: 8,
      instructions: "Focus on unilateral work — lunges, single-leg RDL, step-ups.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 2,
      category: "QUALITY_RUN",
      title: "Tempo Run",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "10 min warm-up. Main: 20 min at 10k pace (comfortably hard). 5 min cool-down.",
    },
    {
      weekday: 3,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 30,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Recovery-easy pace.",
    },
    {
      weekday: 4,
      category: "QUALITY_RUN",
      title: "Intervals",
      minutes: 40,
      rpeMin: 8,
      rpeMax: 9,
      instructions:
        "10 min warm-up. Main: 8 × 400m at 5k pace, 90s jog. 5 min cool-down.",
    },
    {
      weekday: 5,
      category: "EASY_RUN",
      title: "Long Easy Run",
      minutes: 70,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Slow, sustainable — build to 10-12 km.",
    },
  ],
  10: [
    {
      weekday: 0,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Aerobic base.",
    },
    {
      weekday: 1,
      category: "LOWER_STRENGTH",
      title: "Lower Strength",
      minutes: 40,
      rpeMin: 7,
      rpeMax: 8,
      instructions: "Progressive overload — go heavier.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 2,
      category: "QUALITY_RUN",
      title: "Tempo Run",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions:
        "10 min warm-up. Main: 25 min at 10k pace. 5 min cool-down.",
    },
    {
      weekday: 3,
      category: "EASY_RUN",
      title: "Easy Run",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Recovery-easy pace.",
    },
    {
      weekday: 4,
      category: "QUALITY_RUN",
      title: "Intervals",
      minutes: 50,
      rpeMin: 8,
      rpeMax: 9,
      instructions:
        "15 min warm-up. Main: 10 × 400m at 5k pace, 90s jog. 5 min cool-down.",
    },
    {
      weekday: 5,
      category: "EASY_RUN",
      title: "Long Easy Run",
      minutes: 80,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Slow, sustainable — build to 12-14 km.",
    },
  ],
};

// ────── GENERAL FITNESS (balanced, non-goal-specific) ──────
// Mix of strength + cardio, no long mountain session or race intervals.
// Sustainable indefinitely; the "default" plan for someone who just
// wants to stay in shape without a specific event.
const GENERAL_FITNESS: Record<WeeklyHours, DayTemplate[]> = {
  3: [
    {
      weekday: 0,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "3 rounds of the circuit. Focus on form.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 2,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Any modality at conversational pace.",
    },
    {
      weekday: 4,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "3 rounds, add weight where possible.",
      strengthPrescription: FULL_BODY,
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
      instructions: "Progressive overload.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 1,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Any modality, conversational pace.",
    },
    {
      weekday: 2,
      category: "UPPER_STRENGTH",
      title: "Upper Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 8,
      instructions: "Prescribed sets, controlled tempo.",
      strengthPrescription: UPPER,
    },
    {
      weekday: 4,
      category: "ZONE2_CARDIO",
      title: "Zone 2 Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Longer cardio session — bike, jog, or hike.",
    },
    {
      weekday: 5,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "Full body circuit.",
      strengthPrescription: FULL_BODY,
    },
  ],
  7: [
    {
      weekday: 0,
      category: "LOWER_STRENGTH",
      title: "Lower Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 8,
      instructions: "Progressive overload.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 1,
      category: "ZONE2_CARDIO",
      title: "Cardio",
      minutes: 40,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Any modality.",
    },
    {
      weekday: 2,
      category: "UPPER_STRENGTH",
      title: "Upper Strength",
      minutes: 40,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "Prescribed sets.",
      strengthPrescription: UPPER,
    },
    {
      weekday: 3,
      category: "ACTIVE_RECOVERY",
      title: "Active Recovery",
      minutes: 30,
      rpeMin: 2,
      rpeMax: 3,
      instructions: "Easy walk, yoga, or light bike. Move without stress.",
    },
    {
      weekday: 4,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "Full body circuit.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 5,
      category: "ZONE2_CARDIO",
      title: "Long Cardio",
      minutes: 60,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Longer aerobic session — bike, jog, hike, or swim.",
    },
  ],
  10: [
    {
      weekday: 0,
      category: "LOWER_STRENGTH",
      title: "Lower Strength",
      minutes: 50,
      rpeMin: 7,
      rpeMax: 8,
      instructions: "Heavier work.",
      strengthPrescription: LOWER,
    },
    {
      weekday: 1,
      category: "ZONE2_CARDIO",
      title: "Cardio",
      minutes: 45,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Any modality.",
    },
    {
      weekday: 2,
      category: "UPPER_STRENGTH",
      title: "Upper Strength",
      minutes: 45,
      rpeMin: 7,
      rpeMax: 8,
      instructions: "Prescribed sets, progressive overload.",
      strengthPrescription: UPPER,
    },
    {
      weekday: 3,
      category: "QUALITY_RUN",
      title: "Intervals",
      minutes: 40,
      rpeMin: 7,
      rpeMax: 8,
      instructions: "10 min warm-up. Main: 5 × 3 min hard / 2 min easy. Cool-down.",
    },
    {
      weekday: 4,
      category: "FULL_BODY_STRENGTH",
      title: "Full Body Strength",
      minutes: 45,
      rpeMin: 6,
      rpeMax: 7,
      instructions: "Circuit.",
      strengthPrescription: FULL_BODY,
    },
    {
      weekday: 5,
      category: "ZONE2_CARDIO",
      title: "Long Cardio",
      minutes: 90,
      rpeMin: 3,
      rpeMax: 4,
      instructions: "Longer aerobic session.",
    },
  ],
};

// Dispatch: pick the template family for a given goal type. Anything
// we don't have a bespoke template for falls back to general fitness
// so we never fail to generate.
export function templatesForGoal(
  goalType: PlanGoalType,
): Record<WeeklyHours, DayTemplate[]> {
  switch (goalType) {
    case "mountain_summit":
    case "trail_hike":
      return MOUNTAIN_SUMMIT;
    case "race_5k":
      return RACE_5K;
    case "race_10k":
    case "race_half":
    case "race_full":
      // Endurance/race templates share the RACE_5K structure for now
      // (long run + tempo + intervals). Real half/full would want
      // longer long-runs; add when needed.
      return RACE_5K;
    case "strength_cycle":
    case "endurance_base":
    case "general_fitness":
      return GENERAL_FITNESS;
    default:
      return GENERAL_FITNESS;
  }
}

/**
 * Default plan length in weeks for each goal. Users can override on
 * creation — this is just the sensible default when they don't specify.
 */
export function defaultWeeksForGoal(goalType: PlanGoalType): number {
  switch (goalType) {
    case "mountain_summit":
      return 40; // Rainier-scale prep
    case "trail_hike":
      return 12;
    case "race_5k":
      return 8; // couch-to-5k territory
    case "race_10k":
      return 12;
    case "race_half":
      return 16;
    case "race_full":
      return 20;
    case "strength_cycle":
      return 12;
    case "endurance_base":
    case "general_fitness":
      return 12; // rolling; user can extend
    default:
      return 12;
  }
}
