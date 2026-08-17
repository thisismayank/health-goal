CREATE TABLE "intervals_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"athlete_id" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"api_key_last4" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intervals_account" ADD CONSTRAINT "intervals_account_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "intervals_account_user_idx" ON "intervals_account" USING btree ("user_id");