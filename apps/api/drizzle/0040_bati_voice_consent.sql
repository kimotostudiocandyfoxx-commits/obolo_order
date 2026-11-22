ALTER TABLE "users" ADD COLUMN "voice_bati_state" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guardian_consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guardian_consent_at" timestamp with time zone;