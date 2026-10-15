ALTER TABLE "invites" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_by_message" text;