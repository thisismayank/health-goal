CREATE TABLE "strava_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"athlete_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_webhook_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"callback_url" text NOT NULL,
	"verify_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_activity_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata_json" text
);
--> statement-breakpoint
ALTER TABLE "strava_account" ADD CONSTRAINT "strava_account_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_source" ADD CONSTRAINT "workout_source_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strava_account_user_idx" ON "strava_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_account_athlete_idx" ON "strava_account" USING btree ("athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_source_provider_activity_idx" ON "workout_source" USING btree ("provider","provider_activity_id");