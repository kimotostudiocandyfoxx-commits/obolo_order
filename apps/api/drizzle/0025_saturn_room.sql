-- 自分の部屋 (story 2026-10-14): a kororin can be flown to its author's own room only.
ALTER TABLE "saturn_posts" ADD COLUMN "room" integer DEFAULT 0 NOT NULL;
