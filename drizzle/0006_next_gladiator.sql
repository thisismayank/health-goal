ALTER TABLE "trail" ADD COLUMN "preset_slug" text;--> statement-breakpoint
ALTER TABLE "trail" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;