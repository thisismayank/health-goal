CREATE TABLE "trail_completion" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trail_id" integer NOT NULL,
	"completed_at" text NOT NULL,
	"workout_id" integer,
	"time_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trail_completion" ADD CONSTRAINT "trail_completion_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_completion" ADD CONSTRAINT "trail_completion_trail_id_trail_id_fk" FOREIGN KEY ("trail_id") REFERENCES "public"."trail"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_completion" ADD CONSTRAINT "trail_completion_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE set null ON UPDATE no action;