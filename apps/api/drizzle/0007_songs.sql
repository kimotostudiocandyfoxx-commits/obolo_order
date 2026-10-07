CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"design_json" jsonb NOT NULL,
	"instrumental_url" text NOT NULL,
	"phrases_json" jsonb NOT NULL,
	"mix_json" jsonb NOT NULL,
	"direction_json" jsonb NOT NULL,
	"mix_url" text NOT NULL,
	"seconds" real NOT NULL,
	"saved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "songs_user_idx" ON "songs" USING btree ("user_id","created_at");