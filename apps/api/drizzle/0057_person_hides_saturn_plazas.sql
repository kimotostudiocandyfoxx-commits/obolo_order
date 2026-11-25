CREATE TABLE "person_hides" (
	"user_id" uuid NOT NULL,
	"hidden_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_hides" ADD CONSTRAINT "person_hides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_hides" ADD CONSTRAINT "person_hides_hidden_id_users_id_fk" FOREIGN KEY ("hidden_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_hides_pair_idx" ON "person_hides" USING btree ("user_id","hidden_id");--> statement-breakpoint
-- planets 2-4 (M-R316 / M-R317): Saturn's plazas on the rings (prototype design/home/template.html CONT.saturn / RULE.saturn). The five the prototype credits to people ("by タク" …) are the operator's too (creator_id NULL: no name is ever shown). Pictures come later.
INSERT INTO "continents" ("planet", "key", "name", "rule_json", "tags_json", "sort_order") VALUES
('saturn', 'chat', 'おしゃべり広場', '{"g": ["雑談"], "m": ["ゆるい", "日常"]}'::jsonb, '["雑談", "ゆるい", "日常"]'::jsonb, 1),
('saturn', 'koi', '恋バナの部屋', '{"g": ["恋バナ"], "m": ["好きな人", "ドキドキ"]}'::jsonb, '["恋バナ", "ドキドキ", "好きな人"]'::jsonb, 2),
('saturn', 'oshi', '推し語りステージ', '{"g": ["推し"], "m": ["アイドル", "ライブ"]}'::jsonb, '["推し", "アイドル", "ライブ"]'::jsonb, 3),
('saturn', 'school', '放課後テラス', '{"g": ["学校"], "m": ["部活", "テスト"]}'::jsonb, '["学校", "部活", "テスト"]'::jsonb, 4),
('saturn', 'night', '夜ふかしラウンジ', '{"g": ["夜"], "m": ["深夜", "眠れない"]}'::jsonb, '["夜", "眠れない", "深夜"]'::jsonb, 5),
('saturn', 'game', 'ゲーム実況の島', '{"g": ["ゲーム"], "m": ["対戦", "実況"]}'::jsonb, '["ゲーム", "実況", "対戦"]'::jsonb, 6),
('saturn', 'warai', 'お笑い劇場', '{"g": ["お笑い"], "m": ["ボケ", "ツッコミ"]}'::jsonb, '["お笑い", "ボケ", "ツッコミ"]'::jsonb, 7),
('saturn', 'anime', 'アニメ語りカフェ', '{"g": ["アニメ"], "m": ["名シーン", "マンガ"]}'::jsonb, '["アニメ", "マンガ", "名シーン"]'::jsonb, 8),
('saturn', 'asa', 'おはよう広場', '{"g": ["朝"], "m": ["おはよう", "元気"]}'::jsonb, '["朝", "おはよう", "元気"]'::jsonb, 9),
('saturn', 'nemui', 'ねむねむ星', '{"g": ["眠い"], "m": ["おやすみ"]}'::jsonb, '["眠い", "ゆるい", "おやすみ"]'::jsonb, 10)
ON CONFLICT ("planet", "key") DO NOTHING;