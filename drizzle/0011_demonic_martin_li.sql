CREATE TABLE "squad" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invite_token" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squad_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "squad_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"squad_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "squad" ADD CONSTRAINT "squad_created_by_user_profile_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_member" ADD CONSTRAINT "squad_member_squad_id_squad_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_member" ADD CONSTRAINT "squad_member_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "squad_member_uniq" ON "squad_member" USING btree ("squad_id","user_id");