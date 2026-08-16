CREATE TABLE "auth_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "magic_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"requested_email" text NOT NULL,
	"user_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "created_via" text DEFAULT 'magic_link' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link" ADD CONSTRAINT "magic_link_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_email_lower_idx" ON "user_profile" USING btree ("email");