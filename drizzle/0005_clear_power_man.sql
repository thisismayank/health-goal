CREATE TABLE "trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"distance_km" real NOT NULL,
	"elevation_gain_ft" integer NOT NULL,
	"max_altitude_ft" integer NOT NULL,
	"typical_hours" real NOT NULL,
	"pack_weight_lb" real DEFAULT 0 NOT NULL,
	"terrain_grade" text DEFAULT 'moderate' NOT NULL,
	"target_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail" ADD CONSTRAINT "trail_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;