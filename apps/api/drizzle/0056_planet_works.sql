CREATE TABLE "continent_seen" (
	"user_id" uuid NOT NULL,
	"planet" text NOT NULL,
	"key" text NOT NULL,
	"shown_at" timestamp with time zone,
	"landed_at" timestamp with time zone,
	CONSTRAINT "continent_seen_user_id_planet_key_pk" PRIMARY KEY("user_id","planet","key")
);
--> statement-breakpoint
CREATE TABLE "continents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"creator_id" uuid,
	"rule_json" jsonb NOT NULL,
	"tags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sky_url" text,
	"land_url" text,
	"shore_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "planet_work_meta" (
	"kind" text NOT NULL,
	"work_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"planet" text NOT NULL,
	"main" text,
	"moods_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bpm" integer,
	"visibility" text,
	"check_state" text DEFAULT 'unchecked' NOT NULL,
	"check_reason" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planet_work_meta_kind_work_id_pk" PRIMARY KEY("kind","work_id")
);
--> statement-breakpoint
ALTER TABLE "bluena_saves" DROP CONSTRAINT "bluena_saves_post_id_planet_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "bluena_saves" DROP CONSTRAINT "bluena_saves_user_id_post_id_pk";--> statement-breakpoint
ALTER TABLE "bluena_saves" ADD COLUMN "kind" text DEFAULT 'planet_post' NOT NULL;--> statement-breakpoint
ALTER TABLE "bluena_saves" ADD CONSTRAINT "bluena_saves_user_id_kind_post_id_pk" PRIMARY KEY("user_id","kind","post_id");--> statement-breakpoint
ALTER TABLE "jupiter_roots" ADD COLUMN "spell_json" jsonb;--> statement-breakpoint
ALTER TABLE "planet_homes" ADD COLUMN "continent_favs_json" jsonb;--> statement-breakpoint
ALTER TABLE "continent_seen" ADD CONSTRAINT "continent_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continents" ADD CONSTRAINT "continents_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_work_meta" ADD CONSTRAINT "planet_work_meta_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "continents_planet_key_uq" ON "continents" USING btree ("planet","key");--> statement-breakpoint
CREATE INDEX "continents_planet_idx" ON "continents" USING btree ("planet","sort_order");--> statement-breakpoint
CREATE INDEX "planet_work_meta_planet_idx" ON "planet_work_meta" USING btree ("planet","created_at");--> statement-breakpoint
CREATE INDEX "planet_work_meta_user_idx" ON "planet_work_meta" USING btree ("user_id");--> statement-breakpoint
-- planets 2-4: the operator's continents of Mercury and Jupiter (prototype design/home/template.html CONT / RULE). Pictures come later (sky_url / land_url / shore_url NULL).
INSERT INTO "continents" ("planet", "key", "name", "rule_json", "tags_json", "sort_order") VALUES
('mercury', 'edm', 'EDM大陸', '{"g": ["EDM"], "m": ["ダンス", "フェス"], "bpm": [118, 999]}'::jsonb, '["EDM", "ダンス", "フェス", "アゲ"]'::jsonb, 1),
('mercury', 'hiphop', 'ヒップホップ王国', '{"g": ["ヒップホップ"], "m": ["ストリート"]}'::jsonb, '["ヒップホップ", "ラップ", "ストリート"]'::jsonb, 2),
('mercury', 'ballad', 'バラード島', '{"g": ["バラード"], "m": ["しっとり"], "bpm": [0, 90]}'::jsonb, '["バラード", "しっとり", "泣ける"]'::jsonb, 3),
('mercury', 'rock', 'ロック火山', '{"g": ["ロック"], "m": ["熱い"]}'::jsonb, '["ロック", "バンド", "熱い"]'::jsonb, 4),
('mercury', 'chill', 'チルの環礁', '{"g": ["ローファイ"], "m": ["チル", "作業用"], "bpm": [0, 100]}'::jsonb, '["チル", "ローファイ", "作業用"]'::jsonb, 5),
('mercury', 'citypop', 'シティポップ湾', '{"g": ["シティポップ"], "m": ["夜ドライブ", "80s"]}'::jsonb, '["シティポップ", "80s", "夜ドライブ"]'::jsonb, 6),
('mercury', 'anison', 'アニソン諸島', '{"g": ["アニソン"], "m": ["アニメ"]}'::jsonb, '["アニソン", "アニメ", "アゲ"]'::jsonb, 7),
('mercury', 'jazz', 'ジャズの入り江', '{"g": ["ジャズ"], "m": ["おしゃれ"]}'::jsonb, '["ジャズ", "おしゃれ", "夜"]'::jsonb, 8),
('mercury', 'matsuri', '夏祭りの島', '{"g": [], "m": ["祭り", "和風", "夏"]}'::jsonb, '["夏", "和風", "祭り", "アゲ"]'::jsonb, 9),
('mercury', 'rain', '雨音の島', '{"g": [], "m": ["雨"]}'::jsonb, '["雨", "チル", "作業用", "しっとり"]'::jsonb, 10),
('jupiter', 'watercolor', '水彩の森', '{"g": ["水彩"], "m": ["やさしい", "パステル"]}'::jsonb, '["水彩", "やさしい", "パステル"]'::jsonb, 1),
('jupiter', 'anime', 'アニメ塗りの丘', '{"g": ["アニメ塗り"], "m": ["キラキラ", "人物"]}'::jsonb, '["アニメ塗り", "キラキラ", "人物"]'::jsonb, 2),
('jupiter', 'pixel', 'ドット絵の村', '{"g": ["ドット絵"], "m": ["ゲーム", "レトロ"]}'::jsonb, '["ドット絵", "レトロ", "ゲーム"]'::jsonb, 3),
('jupiter', 'oil', '油絵の金の森', '{"g": ["油絵"], "m": ["あたたか"]}'::jsonb, '["油絵", "あたたか", "風景"]'::jsonb, 4),
('jupiter', 'yumekawa', 'ゆめかわの花畑', '{"g": ["ゆめかわ"], "m": ["パステル", "かわいい"]}'::jsonb, '["ゆめかわ", "パステル", "かわいい"]'::jsonb, 5),
('jupiter', 'cats', 'ねこの森', '{"g": [], "m": ["ねこ", "どうぶつ"]}'::jsonb, '["ねこ", "どうぶつ", "かわいい"]'::jsonb, 6),
('jupiter', 'nightview', '夜景の丘', '{"g": [], "m": ["夜景", "夜"]}'::jsonb, '["夜", "夜景", "つめたい"]'::jsonb, 7),
('jupiter', 'wamodern', '和モダンの庭', '{"g": ["和モダン"], "m": ["和風"]}'::jsonb, '["和風", "和モダン", "花"]'::jsonb, 8),
('jupiter', 'retropop', 'レトロポップ広場', '{"g": ["レトロ", "ポップ"], "m": ["ポップ", "あざやか"]}'::jsonb, '["レトロ", "ポップ", "あざやか"]'::jsonb, 9),
('jupiter', 'mono', 'モノクロの森', '{"g": ["モノクロ"], "m": ["白黒"]}'::jsonb, '["モノクロ", "白黒", "かっこいい"]'::jsonb, 10)
ON CONFLICT ("planet", "key") DO NOTHING;
