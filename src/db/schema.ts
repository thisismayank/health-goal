import {
  boolean,
  index,
  integer,
  jsonb,
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
    // Raw ColdStartAnswers JSON from the /start flow, persisted so the
    // verdict engine can layer a self-reported baseline into
    // FitnessSnapshot post-signup. Prevents the "verdict silently
    // degrades after email handoff" bug the Reddit-launch test caught.
    coldStartAnswers: jsonb("cold_start_answers"),
    sex: text("sex"),
    heightCm: real("height_cm"),
    currentWeightKg: real("current_weight_kg"),
    timezone: text("timezone").notNull().default("America/New_York"),
    // Freeform label like "Manhattan, NY". Kept for display + so we
    // can re-geocode if the user asks. Nullable — many users won't
    // set it and everything below degrades gracefully.
    homeLocation: text("home_location"),
    // Resolved coords for the home base, used by /trails "near me"
    // ranking. Nullable together with homeLocation; either both are
    // set (via the settings form) or both are null.
    homeLat: real("home_lat"),
    homeLng: real("home_lng"),
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
    // Last computed Hiker Class we've persisted. Compared to the current
    // computed class on home render to detect class-ups → celebration
    // modal. First-seen initializes silently (no celebration on signup).
    lastKnownClass: text("last_known_class"),
    // Onboarding-collected training constraints. Used by the plan
    // generator at signup, kept on profile for later regeneration.
    weeklyTrainingHours: integer("weekly_training_hours"),
    startingFitness: text("starting_fitness"),
    // Display preference: 'imperial' shows ft/mi/lb, 'metric' shows
    // m/km/kg. Storage stays canonical (SI internally); this only
    // affects rendering. Defaults to imperial since the mountaineering
    // world in the US is imperial and metric users are the minority.
    units: text("units", { enum: ["imperial", "metric"] })
      .notNull()
      .default("imperial"),
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
// code is a 6-digit alternative to the URL token — mobile users can type
// it into the same tab where they entered their email, avoiding the
// cross-app browser jump that loses the cold_start_seed cookie.
export const magicLink = pgTable("magic_link", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  code: text("code"),
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

export const PLAN_GOAL_TYPES = [
  "mountain_summit",
  "trail_hike",
  "race_5k",
  "race_10k",
  "race_half",
  "race_full",
  "strength_cycle",
  "endurance_base",
  "general_fitness",
] as const;
export type PlanGoalType = (typeof PLAN_GOAL_TYPES)[number];

export const PLAN_SOURCES = ["generated", "uploaded", "hybrid"] as const;
export type PlanSource = (typeof PLAN_SOURCES)[number];

export const trainingPlan = pgTable("training_plan", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goalEvent: text("goal_event"),
  // Broad category of what the plan is optimizing for. Drives which
  // template family the generator picks + which coach voice to use.
  // Nullable for backward compatibility; existing plans get backfilled
  // to 'mountain_summit' in migration 0020.
  goalType: text("goal_type", { enum: PLAN_GOAL_TYPES }),
  // How the plan came to exist. Uploaded plans skip generator-based
  // regen when we detect gap changes (we shouldn't rewrite the user's
  // own plan out from under them).
  source: text("source", { enum: PLAN_SOURCES }).notNull().default("generated"),
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
  // GPS start point (WGS84) if the source provides it. Nullable — many
  // indoor / manual workouts have no location. Used by the trail
  // matcher to find preset trails within ~5 km of where the activity
  // began.
  startLat: real("start_lat"),
  startLng: real("start_lng"),
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
  "intervals",
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

export const LLM_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const llmCredentials = pgTable(
  "llm_credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: LLM_PROVIDERS }).notNull(),
    // AES-256-GCM encrypted (see @/lib/crypto). Never returned to
    // client — only decrypted server-side inside the coach request.
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    apiKeyLast4: text("api_key_last4").notNull(),
    // Model id — provider-specific string. Null = pick a sensible
    // default at request time.
    modelId: text("model_id"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("llm_credentials_user_idx").on(table.userId)],
);

export const coachMessage = pgTable(
  "coach_message",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    // Which role emitted this turn. 'system' rows are ephemeral —
    // we never persist system prompts (they're regenerated with fresh
    // plan/activity context on each send).
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    // Model + provider used for the assistant reply. Nullable on user
    // turns.
    provider: text("provider"),
    modelId: text("model_id"),
    // Rough token accounting so users can see what they're spending.
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    // "tee_up" for auto-generated openers we produce when the user
    // opens /coach after a >24h gap. Distinguishes them from real
    // assistant replies so we can, e.g., style them subtly or exclude
    // them from history rollups. Null for organic turns.
    origin: text("origin"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// Rolling per-user summary of coach-chat history beyond the recent
// window. Regenerated when the unsummarized turn count exceeds a
// threshold. One row per user; content is the LLM-produced digest.
export const coachSummary = pgTable(
  "coach_summary",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" })
      .unique(),
    content: text("content").notNull(),
    // Highest coach_message.id that's been folded into `content`.
    // On regen we summarize everything with id > throughMessageId +
    // the prior summary as prior context.
    throughMessageId: integer("through_message_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const intervalsAccount = pgTable(
  "intervals_account",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id").notNull(),
    // API key is AES-256-GCM encrypted before storage. Stored as
    // base64(iv || authTag || ciphertext). See @/lib/crypto.
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    // Displayed to the user as verification ("••••1234") — safe to
    // store in plaintext since only the last 4 chars.
    apiKeyLast4: text("api_key_last4").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("intervals_account_user_idx").on(table.userId)],
);

export const ouraAccount = pgTable(
  "oura_account",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id, { onDelete: "cascade" }),
    // Oura returns an internal user identifier we can use to dedupe
    // repeat connects; nullable because their `/personal_info` endpoint
    // is optional to call.
    ouraUserId: text("oura_user_id"),
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
  (table) => [uniqueIndex("oura_account_user_idx").on(table.userId)],
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

// Body regions we can adapt the plan around. Kept coarse — the
// adaptation rules (lib/plan/injury-adaptation.ts) don't need
// per-joint granularity, and giving users too many options invites
// analysis paralysis. Users add free-text notes for the specifics.
export const INJURY_REGIONS = [
  "knee",
  "back",
  "ankle",
  "hip",
  "shoulder",
  "other",
] as const;
export type InjuryRegion = (typeof INJURY_REGIONS)[number];

// Severity ladder. Determines how aggressive the adaptation is:
//   - 'light': downgrade intensity/load, keep the modality.
//   - 'moderate': swap the session modality (running → cycling,
//     lower-body strength → upper-body).
//   - 'recovering': skip anything conflicting entirely, replace
//     with mobility / active recovery.
export const INJURY_SEVERITIES = ["light", "moderate", "recovering"] as const;
export type InjurySeverity = (typeof INJURY_SEVERITIES)[number];

export const injury = pgTable("injury", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  region: text("region", { enum: INJURY_REGIONS }).notNull(),
  severity: text("severity", { enum: INJURY_SEVERITIES }).notNull(),
  // Free-text so users can capture the specific ("MCL sprain",
  // "spinal impingement flare from Tuesday's deadlift"). Coach
  // context uses this verbatim.
  notes: text("notes"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  // Null = active. Setting endDate resolves the injury; adaptation
  // stops applying and coach context stops mentioning it.
  endDate: text("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
      enum: ["daily", "weekly", "trail", "plan", "itinerary", "featured"],
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
    pushEnabled: boolean("push_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqPref: uniqueIndex("notification_preference_uniq").on(t.userId, t.kind),
  }),
);

// One row per notification sent. dedupeKey is a per-user unique key used
// to prevent double-sends when the cron reruns (e.g. trip_45_t-3 = at
// most one send per trail per phase per channel). Unique includes
// channel so email + push can both fire for the same event.
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
      t.channel,
    ),
  }),
);

// Web push subscription — one per (user, browser/device). Endpoint is
// the Push service URL (browser-specific). p256dh + auth are the
// subscription's encryption keys. On 410 Gone from Push service we
// delete the row.
export const pushSubscription = pgTable("push_subscription", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

// Product analytics event stream. Append-only, minimal shape. userId
// is null for pre-signup traffic (the anonymous sessionId links a
// stranger's /start visit to their eventual signup). properties is
// a small blob for event-specific context (trail slug, verdict
// value, source utm, etc.) — kept flexible on purpose.
export const event = pgTable(
  "event",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => userProfile.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").notNull(),
    name: text("name").notNull(),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("event_created_at_idx").on(t.createdAt),
    index("event_name_created_at_idx").on(t.name, t.createdAt),
    index("event_session_id_idx").on(t.sessionId),
  ],
);

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
export type PushSubscription = typeof pushSubscription.$inferSelect;
