-- story 2026-11-25: グッズ made in the Moon atelier (a kind + one of the member's own arts, composited by the app; Uranus' home store once flown) and a game's case picture (one of the member's arts or one Bati painted for it; null = the neon face)
CREATE TABLE "goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"root_id" uuid,
	"art_url" text NOT NULL,
	"title" text NOT NULL,
	"home_planet" text DEFAULT 'uranus' NOT NULL,
	"flown_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "cover_root_id" uuid;--> statement-breakpoint
ALTER TABLE "goods" ADD CONSTRAINT "goods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_user_idx" ON "goods" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "goods_flown_idx" ON "goods" USING btree ("flown_at");