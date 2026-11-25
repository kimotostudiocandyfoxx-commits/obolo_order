ALTER TABLE "media_objects" ADD COLUMN "move_state" text;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "move_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "move_error" text;--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "moved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "media_objects_storage_idx" ON "media_objects" USING btree ("storage","id");