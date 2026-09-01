CREATE TABLE "event" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" text NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_created_at_idx" ON "event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "event_name_created_at_idx" ON "event" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "event_session_id_idx" ON "event" USING btree ("session_id");