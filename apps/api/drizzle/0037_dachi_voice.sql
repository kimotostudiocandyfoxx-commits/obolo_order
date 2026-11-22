CREATE TABLE "dachi_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid,
	"recipient_id" uuid,
	"character" text,
	"peer_id" uuid,
	"line_id" text,
	"kind" text DEFAULT 'voice' NOT NULL,
	"audio_url" text,
	"audio_media_id" uuid,
	"seconds" real,
	"work_json" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "voice_media_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "voice_url" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "voice_seconds" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dachi_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dachi_messages" ADD CONSTRAINT "dachi_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dachi_messages" ADD CONSTRAINT "dachi_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dachi_messages" ADD CONSTRAINT "dachi_messages_peer_id_users_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dachi_messages_recipient_idx" ON "dachi_messages" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "dachi_messages_sender_idx" ON "dachi_messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dachi_messages_line_uq" ON "dachi_messages" USING btree ("recipient_id","line_id") WHERE "dachi_messages"."line_id" IS NOT NULL;