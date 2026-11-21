CREATE TABLE "bluena_saves" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bluena_saves_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "radio_lives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"thumb_url" text,
	"loop" text DEFAULT 'drift' NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"now_json" jsonb,
	"transport" text DEFAULT 'test' NOT NULL,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"stopped_reason" text
);
--> statement-breakpoint
CREATE TABLE "radio_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"live_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"post_id" uuid,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_id" uuid,
	"title" text NOT NULL,
	"audio_url" text NOT NULL,
	"thumb_url" text,
	"loop" text DEFAULT 'drift' NOT NULL,
	"seconds" real NOT NULL,
	"cues_json" jsonb NOT NULL,
	"source" text DEFAULT 'recorded' NOT NULL,
	"live_id" uuid,
	"status" text DEFAULT 'private' NOT NULL,
	"published_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "allow_radio" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reports" ADD COLUMN "target_id" uuid;--> statement-breakpoint
ALTER TABLE "bluena_saves" ADD CONSTRAINT "bluena_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bluena_saves" ADD CONSTRAINT "bluena_saves_post_id_planet_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."planet_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_lives" ADD CONSTRAINT "radio_lives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_messages" ADD CONSTRAINT "radio_messages_live_id_radio_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."radio_lives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_messages" ADD CONSTRAINT "radio_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_messages" ADD CONSTRAINT "radio_messages_post_id_planet_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."planet_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_shows" ADD CONSTRAINT "radio_shows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_shows" ADD CONSTRAINT "radio_shows_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bluena_saves_user_idx" ON "bluena_saves" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "radio_lives_status_idx" ON "radio_lives" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "radio_lives_user_idx" ON "radio_lives" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "radio_messages_live_idx" ON "radio_messages" USING btree ("live_id","created_at");--> statement-breakpoint
CREATE INDEX "radio_shows_user_idx" ON "radio_shows" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "radio_shows_public_idx" ON "radio_shows" USING btree ("status","published_at");