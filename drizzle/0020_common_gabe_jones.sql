ALTER TABLE "training_plan" ADD COLUMN "goal_type" text;--> statement-breakpoint
ALTER TABLE "training_plan" ADD COLUMN "source" text DEFAULT 'generated' NOT NULL;--> statement-breakpoint
-- Backfill: every existing plan predates goal_type + is assumed to be
-- the original mountain-summit template. Safe default; users can pick
-- again from the new /plan/new UI if they had a different goal.
UPDATE "training_plan" SET "goal_type" = 'mountain_summit' WHERE "goal_type" IS NULL;