import type { PlanGoalType } from "@/db/schema";

export const GOAL_LABEL: Record<PlanGoalType, string> = {
  mountain_summit: "Mountain summit",
  trail_hike: "Trail / hike",
  race_5k: "5k race",
  race_10k: "10k race",
  race_half: "Half marathon",
  race_full: "Marathon",
  strength_cycle: "Strength cycle",
  endurance_base: "Endurance base",
  general_fitness: "General fitness",
};

export const GOAL_DESCRIPTION: Record<PlanGoalType, string> = {
  mountain_summit:
    "Multi-month prep for a specific summit (Rainier, Kili, Aconcagua). Long mountain sessions, strength, load carry.",
  trail_hike: "Specific hike coming up. Mountain-day-shape training block.",
  race_5k: "8 weeks. Interval + tempo + long-easy structure.",
  race_10k: "12 weeks. More volume, same structure as 5k.",
  race_half: "16 weeks. Long runs to 20+ km.",
  race_full: "20 weeks. Marathon-scale long runs.",
  strength_cycle: "Focused strength progression, minimal cardio.",
  endurance_base: "Aerobic base building, no specific event.",
  general_fitness: "Balanced strength + cardio, rolling. No specific event.",
};
