CREATE TABLE "daily_metric" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"body_weight_kg" real,
	"fatigue_1_to_10" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "planned_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"date" text NOT NULL,
	"session_category" text NOT NULL,
	"subtype" text,
	"title" text NOT NULL,
	"target_duration_minutes" integer,
	"target_distance_km" real,
	"target_elevation_gain_ft" integer,
	"target_pack_weight_lb" real,
	"target_rpe_min" integer,
	"target_rpe_max" integer,
	"target_zone" text,
	"instructions" text,
	"strength_prescription" text,
	"status" text DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strength_exercise" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" integer NOT NULL,
	"exercise_name" text NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer,
	"weight_kg" real,
	"rir" integer,
	"rpe" integer
);
--> statement-breakpoint
CREATE TABLE "training_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"goal_event" text,
	"start_date" text NOT NULL,
	"event_date" text,
	"current_phase" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sex" text,
	"height_cm" real,
	"current_weight_kg" real,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"home_location" text,
	"summit_goal" text,
	"summit_date" text,
	"dietary_preference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"planned_session_id" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"type" text NOT NULL,
	"duration_seconds" integer,
	"distance_meters" real,
	"elevation_gain_meters" real,
	"average_hr" integer,
	"max_hr" integer,
	"rpe" integer,
	"pack_weight_kg" real,
	"notes" text,
	"canonical_source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_metric" ADD CONSTRAINT "daily_metric_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_session" ADD CONSTRAINT "planned_session_plan_id_training_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_exercise" ADD CONSTRAINT "strength_exercise_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_planned_session_id_planned_session_id_fk" FOREIGN KEY ("planned_session_id") REFERENCES "public"."planned_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metric_user_date_idx" ON "daily_metric" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_session_plan_date_idx" ON "planned_session" USING btree ("plan_id","date");