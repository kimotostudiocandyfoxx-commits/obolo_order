CREATE TABLE "mv_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"materials_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plan_json" jsonb,
	"video_url" text,
	"lyrics_video_url" text,
	"poster_url" text,
	"seconds" real,
	"note" text,
	"backstage_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mv_projects" ADD CONSTRAINT "mv_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mv_projects" ADD CONSTRAINT "mv_projects_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mv_projects_user_idx" ON "mv_projects" USING btree ("user_id","created_at");