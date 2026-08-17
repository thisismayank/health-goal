CREATE TABLE "coach_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"through_message_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_summary_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "coach_message" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "coach_summary" ADD CONSTRAINT "coach_summary_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;