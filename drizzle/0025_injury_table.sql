CREATE TABLE "injury" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"region" text NOT NULL,
	"severity" text NOT NULL,
	"notes" text,
	"start_date" text NOT NULL,
	"end_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "injury" ADD CONSTRAINT "injury_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;