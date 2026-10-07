CREATE TABLE "saturn_plaza_members" (
	"plaza_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saturn_plazas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '⭐' NOT NULL,
	"created_by" uuid,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "saturn_posts" ADD COLUMN "plaza_id" uuid;--> statement-breakpoint
ALTER TABLE "saturn_plaza_members" ADD CONSTRAINT "saturn_plaza_members_plaza_id_saturn_plazas_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."saturn_plazas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saturn_plaza_members" ADD CONSTRAINT "saturn_plaza_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saturn_plazas" ADD CONSTRAINT "saturn_plazas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saturn_plaza_members_pair_idx" ON "saturn_plaza_members" USING btree ("plaza_id","user_id");--> statement-breakpoint
CREATE INDEX "saturn_plaza_members_user_idx" ON "saturn_plaza_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saturn_plazas_name_idx" ON "saturn_plazas" USING btree ("name");--> statement-breakpoint
CREATE INDEX "saturn_plazas_members_idx" ON "saturn_plazas" USING btree ("member_count");--> statement-breakpoint
CREATE INDEX "saturn_posts_plaza_idx" ON "saturn_posts" USING btree ("plaza_id","created_at");--> statement-breakpoint
INSERT INTO "saturn_plazas" ("name", "icon") VALUES ('日本', '🏯'), ('北海道', '⛄'), ('茨城', '🌸'), ('アメリカ', '🗽'), ('K-POP好き', '🎤'), ('アニメ好き', '⛩️'), ('ゲーム好き', '🎮'), ('ラーメン好き', '🍜') ON CONFLICT DO NOTHING;