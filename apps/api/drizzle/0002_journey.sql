-- Replace the Day-1-only onboarding stage with the 8-day journey (client decision 2026-10-04).
ALTER TABLE "users" ADD COLUMN "journey_day" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "journey_completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "journey_day" = 1, "journey_completed_at" = NULL WHERE "onboarding_stage" = 'day1';--> statement-breakpoint
UPDATE "users" SET "journey_day" = 1, "journey_completed_at" = COALESCE("day1_completed_at", now()) WHERE "onboarding_stage" = 'day1_done';--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding_stage";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "day1_completed_at";
