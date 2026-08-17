CREATE TABLE "coach_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"provider" text,
	"model_id" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"api_key_last4" text NOT NULL,
	"model_id" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_message" ADD CONSTRAINT "coach_message_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_credentials" ADD CONSTRAINT "llm_credentials_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "llm_credentials_user_idx" ON "llm_credentials" USING btree ("user_id");