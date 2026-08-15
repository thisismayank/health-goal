ALTER TABLE "daily_metric" ADD COLUMN "sleep_minutes" integer;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD COLUMN "hrv_ms" real;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD COLUMN "resting_hr_bpm" integer;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD COLUMN "steps" integer;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD COLUMN "active_energy_kcal" integer;--> statement-breakpoint
ALTER TABLE "daily_metric" ADD COLUMN "last_auto_sync_at" timestamp with time zone;