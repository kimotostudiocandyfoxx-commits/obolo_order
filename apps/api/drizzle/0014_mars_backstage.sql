CREATE TABLE "mars_backstage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_id" uuid,
	"url" text NOT NULL,
	"poster_url" text,
	"seconds" real,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mars_backstage" ADD CONSTRAINT "mars_backstage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mars_backstage" ADD CONSTRAINT "mars_backstage_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mars_backstage_user_idx" ON "mars_backstage" USING btree ("user_id","created_at");--> statement-breakpoint
-- videos kept on Jupiter move to Mars's 裏スタジオ (Jupiter is photos only from now on)
INSERT INTO "mars_backstage" ("user_id", "media_id", "url", "poster_url", "created_at", "updated_at") SELECT "user_id", "media_id", "url", "poster_url", "created_at", now() FROM "jupiter_roots" WHERE "kind" = 'video' AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "jupiter_roots" SET "deleted_at" = now() WHERE "kind" = 'video' AND "deleted_at" IS NULL;
