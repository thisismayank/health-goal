import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userProfile = pgTable(
  "user_profile",
  {
    id: serial("id").primaryKey(),
    // Email is nullable during the transition from single-user seed to
    // multi-tenant, then backfilled + treated as required in application
    // code. Case-insensitive uniqueness enforced via lowercase index below.
    email: text("email"),
    name: text("name").notNull(),
    // Where the user account came from: "seed" for the original single-user
    // install (Mayank), "magic_link" for self-service signups, "invite" for
    // squad invites once that ships.
    createdVia: text("created_via").notNull().default("magic_link"),
    sex: text("sex"),
    heightCm: real("height_cm"),
    currentWeightKg: real("current_weight_kg"),
    timezone: text("timezone").notNull().default("America/New_York"),
    homeLocation: text("home_location"),
    summitGoal: text("summit_goal"),
    summitDate: text("summit_date"),
    dietaryPreference: text("dietary_preference"),
    // Null = hasn't completed onboarding yet → routed to /welcome.
    // Set = timestamp of finish (or skip). Seed users are backfilled to now().
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    // Subscription tier — 'free' (default), 'pro' (paid), 'admin' (bypass
    // all limits, no billing). Stripe integration lives in a future slice;
    // this column exists now so gates can be enforced immediately and
    // upgrade paths can be surfaced. Seed users backfilled to 'admin'.
    plan: text("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailLowerIdx: uniqueIndex("user_profile_email_lower_idx").on(t.email),
  }),
);

// Auth session — one row per active login. Deleted on sign-out or expiry.
export const authSession = pgTable("auth_session", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Magic-link tokens for passwordless sign-in / signup. userId is nullable
// when the request is for a new email (we upsert the user on verify).
export const magicLink = pgTable("magic_link", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  requestedEmail: text("requested_email").notNull(),
  userId: integer("user_id").references(() => userProfile.id, {
    onDelete: "cascade",
  }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
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
  // External activity name from the source (e.g. Strava activity title like
  // "Morning at Angel's Landing"). Used by auto-completion linking to
  // fuzzy-match workouts against the trail library.
  sourceName: text("source_name"),
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
    // Manual entries (user-typed)
    bodyWeightKg: real("body_weight_kg"),
    fatigue1to10: integer("fatigue_1_to_10"),
    notes: text("notes"),
    // Auto-imported recovery signals (from HealthKit via Health Auto Export
    // or from intervals.icu which mirrors Garmin).
    sleepMinutes: integer("sleep_minutes"),
    hrvMs: real("hrv_ms"),
    restingHrBpm: integer("resting_hr_bpm"),
    steps: integer("steps"),
    activeEnergyKcal: integer("active_energy_kcal"),
    // Extended Garmin wellness (via intervals.icu)
    sleepScore: integer("sleep_score"), // 0-100 (Garmin)
    sleepQuality: integer("sleep_quality"), // 1-5 subjective (Garmin morning survey)
    vo2Max: real("vo2_max"), // mL/kg/min
    spo2Pct: real("spo2_pct"), // %
    bodyFatPct: real("body_fat_pct"), // %
    respirationRpm: real("respiration_rpm"), // breaths/min
    avgSleepingHrBpm: integer("avg_sleeping_hr_bpm"),
    readiness: integer("readiness"), // 0-100 (Garmin)
    stressScore: integer("stress_score"), // 0-100 (Garmin)
    // Training load (computed by intervals.icu from activities)
    ctl: real("ctl"), // Chronic Training Load — 42-day EWMA fitness proxy
    atl: real("atl"), // Acute Training Load — 7-day EWMA fatigue proxy
    lastAutoSyncAt: timestamp("last_auto_sync_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("daily_metric_user_date_idx").on(table.userId, table.date),
  ],
);

export const WORKOUT_SOURCE_PROVIDERS = [
  "manual",
  "strava",
  "healthkit",
  "garmin",
  "fit",
  "gpx",
  "tcx",
] as const;

export type WorkoutSourceProvider = (typeof WORKOUT_SOURCE_PROVIDERS)[number];

export const workoutSource = pgTable(
  "workout_source",
  {
    id: serial("id").primaryKey(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workout.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: WORKOUT_SOURCE_PROVIDERS }).notNull(),
    providerActivityId: text("provider_activity_id").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadataJson: text("metadata_json"),
  },
  (table) => [
    uniqueIndex("workout_source_provider_activity_idx").on(
      table.provider,
      table.providerActivityId,
    ),
  ],
);

export const stravaAccount = pgTable(
  "strava_account",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scope: text("scope"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("strava_account_user_idx").on(table.userId),
    uniqueIndex("strava_account_athlete_idx").on(table.athleteId),
  ],
);

export const stravaWebhookSubscription = pgTable("strava_webhook_subscription", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  callbackUrl: text("callback_url").notNull(),
  verifyToken: text("verify_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const TRAIL_TERRAIN_GRADES = [
  "easy",
  "moderate",
  "hard",
  "technical",
  "mountaineering",
] as const;

export type TrailTerrainGrade = (typeof TRAIL_TERRAIN_GRADES)[number];

export const trail = pgTable("trail", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url"),
  distanceKm: real("distance_km").notNull(),
  elevationGainFt: integer("elevation_gain_ft").notNull(),
  maxAltitudeFt: integer("max_altitude_ft").notNull(),
  typicalHours: real("typical_hours").notNull(),
  packWeightLb: real("pack_weight_lb").notNull().default(0),
  terrainGrade: text("terrain_grade", { enum: TRAIL_TERRAIN_GRADES })
    .notNull()
    .default("moderate"),
  targetDate: text("target_date"),
  notes: text("notes"),
  // If created from the library, remember which preset — used to look up
  // named waypoints for the Summit hero when this trail is the primary goal.
  presetSlug: text("preset_slug"),
  // At most one trail per user should be primary at a time; enforced in the
  // setPrimaryTrail action (no DB-level partial unique to keep the migration
  // simple).
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coachNarrative = pgTable(
  "coach_narrative",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["daily", "weekly", "trail", "plan", "itinerary"],
    }).notNull(),
    // sha256(inputRollupJson + '|' + promptVersion) — deterministic cache key.
    inputHash: text("input_hash").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    contentJson: text("content_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coach_narrative_hash_idx").on(table.inputHash),
  ],
);

// Small friend groups (max 8 members enforced in application code).
// Private by design — no discovery. Membership by invite-link only.
export const squad = pgTable("squad", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Reusable invite token. Anyone with this URL can join (subject to
  // member-cap check at accept time). Regenerated by admin to revoke old
  // links. Null → invites disabled.
  inviteToken: text("invite_token").unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const squadMember = pgTable(
  "squad_member",
  {
    id: serial("id").primaryKey(),
    squadId: integer("squad_id")
      .notNull()
      .references(() => squad.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    // "admin" (can invite + regenerate token + rename) or "member".
    // The creator is admin by default.
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqMember: uniqueIndex("squad_member_uniq").on(t.squadId, t.userId),
  }),
);

// Per-user notification preferences. Opt-out design: if no row exists
// for a (userId, kind) pair, treat as enabled. Missing rows are the
// common case for new users — they get notifications until they opt
// out from /settings.
export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    // Notification event type. Extensible; current values used are:
    //   'trip_week' — T-7 / T-3 / T-1 / T-0 / T+1 trip countdown emails
    //   'squad_activity' — future: squadmate completion pings
    //   'weekly_summary' — future: Sunday recap
    kind: text("kind").notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqPref: uniqueIndex("notification_preference_uniq").on(t.userId, t.kind),
  }),
);

// One row per notification sent. dedupeKey is a per-user unique key
// used to prevent double-sends when the cron reruns (e.g. trip_45_t-3
// = at most one send per trail per phase). channel is 'email' today,
// 'push' once we ship web push.
export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    providerMessageId: text("provider_message_id"),
    ok: boolean("ok").notNull().default(true),
    errorMessage: text("error_message"),
  },
  (t) => ({
    uniqDelivery: uniqueIndex("notification_delivery_uniq").on(
      t.userId,
      t.dedupeKey,
    ),
  }),
);

// One row per attempt/completion of a trail. A single trail can accumulate
// many completions over time (Mount Si → 10x). workoutId links to the
// specific workout that captured the effort, when known.
export const trailCompletion = pgTable("trail_completion", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  trailId: integer("trail_id")
    .notNull()
    .references(() => trail.id, { onDelete: "cascade" }),
  // YMD in user's local timezone at time of logging.
  completedAt: text("completed_at").notNull(),
  workoutId: integer("workout_id").references(() => workout.id, {
    onDelete: "set null",
  }),
  timeMinutes: integer("time_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserProfile = typeof userProfile.$inferSelect;
export type TrainingPlan = typeof trainingPlan.$inferSelect;
export type PlannedSession = typeof plannedSession.$inferSelect;
export type Workout = typeof workout.$inferSelect;
export type StrengthExercise = typeof strengthExercise.$inferSelect;
export type DailyMetric = typeof dailyMetric.$inferSelect;
export type WorkoutSource = typeof workoutSource.$inferSelect;
export type StravaAccount = typeof stravaAccount.$inferSelect;
export type StravaWebhookSubscription = typeof stravaWebhookSubscription.$inferSelect;
export type CoachNarrative = typeof coachNarrative.$inferSelect;
export type Trail = typeof trail.$inferSelect;
export type AuthSession = typeof authSession.$inferSelect;
export type MagicLink = typeof magicLink.$inferSelect;
export type TrailCompletion = typeof trailCompletion.$inferSelect;
export type Squad = typeof squad.$inferSelect;
export type SquadMember = typeof squadMember.$inferSelect;
export type NotificationPreference = typeof notificationPreference.$inferSelect;
export type NotificationDelivery = typeof notificationDelivery.$inferSelect;
