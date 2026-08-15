import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sex: text("sex"),
  heightCm: real("height_cm"),
  currentWeightKg: real("current_weight_kg"),
  timezone: text("timezone").notNull().default("America/New_York"),
  homeLocation: text("home_location"),
  summitGoal: text("summit_goal"),
  summitDate: text("summit_date"),
  dietaryPreference: text("dietary_preference"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingPlan = pgTable("training_plan", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goalEvent: text("goal_event"),
  startDate: text("start_date").notNull(),
  eventDate: text("event_date"),
  currentPhase: integer("current_phase").notNull().default(1),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const SESSION_CATEGORIES = [
  "EASY_RUN",
  "QUALITY_RUN",
  "ZONE2_CARDIO",
  "UPPER_STRENGTH",
  "LOWER_STRENGTH",
  "FULL_BODY_STRENGTH",
  "MOUNTAIN_LEGS",
  "STAIRMASTER",
  "INCLINE_TREADMILL",
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
  "ACTIVE_RECOVERY",
  "MOBILITY",
  "CROSS_TRAINING",
  "REST",
  "UNKNOWN",
] as const;

export type SessionCategory = (typeof SESSION_CATEGORIES)[number];

export const plannedSession = pgTable(
  "planned_session",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => trainingPlan.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    sessionCategory: text("session_category", { enum: SESSION_CATEGORIES })
      .notNull(),
    subtype: text("subtype"),
    title: text("title").notNull(),
    targetDurationMinutes: integer("target_duration_minutes"),
    targetDistanceKm: real("target_distance_km"),
    targetElevationGainFt: integer("target_elevation_gain_ft"),
    targetPackWeightLb: real("target_pack_weight_lb"),
    targetRpeMin: integer("target_rpe_min"),
    targetRpeMax: integer("target_rpe_max"),
    targetZone: text("target_zone"),
    instructions: text("instructions"),
    strengthPrescription: text("strength_prescription"),
    status: text("status", {
      enum: ["planned", "completed", "skipped", "moved"],
    })
      .notNull()
      .default("planned"),
  },
  (table) => [
    uniqueIndex("planned_session_plan_date_idx").on(table.planId, table.date),
  ],
);

export const workout = pgTable("workout", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  plannedSessionId: integer("planned_session_id").references(
    () => plannedSession.id,
    { onDelete: "set null" },
  ),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  type: text("type").notNull(),
  durationSeconds: integer("duration_seconds"),
  distanceMeters: real("distance_meters"),
  elevationGainMeters: real("elevation_gain_meters"),
  averageHr: integer("average_hr"),
  maxHr: integer("max_hr"),
  rpe: integer("rpe"),
  packWeightKg: real("pack_weight_kg"),
  notes: text("notes"),
  canonicalSource: text("canonical_source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const strengthExercise = pgTable("strength_exercise", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workout.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps"),
  weightKg: real("weight_kg"),
  rir: integer("rir"),
  rpe: integer("rpe"),
});

export const dailyMetric = pgTable(
  "daily_metric",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    bodyWeightKg: real("body_weight_kg"),
    fatigue1to10: integer("fatigue_1_to_10"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("daily_metric_user_date_idx").on(table.userId, table.date),
  ],
);

export type UserProfile = typeof userProfile.$inferSelect;
export type TrainingPlan = typeof trainingPlan.$inferSelect;
export type PlannedSession = typeof plannedSession.$inferSelect;
export type Workout = typeof workout.$inferSelect;
export type StrengthExercise = typeof strengthExercise.$inferSelect;
export type DailyMetric = typeof dailyMetric.$inferSelect;
