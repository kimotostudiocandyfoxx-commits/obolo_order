-- The first journey is seven days now (story 2026-10-14): the Moon moved into day 2, so every later day
-- comes one day earlier and Venus is not on the first journey. 1 Earth / 2 Earth→Moon / 3 Saturn /
-- 4 Jupiter / 5 Mercury / 6 Mars / 7 the Eclipse day / 8 ORDER (was 9 and 10).
UPDATE "users" SET "journey_day" = CASE
  WHEN "journey_day" >= 10 THEN 8
  WHEN "journey_day" = 9 THEN 7
  WHEN "journey_day" BETWEEN 3 AND 8 THEN "journey_day" - 1
  ELSE "journey_day" END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "journey_day" SET DEFAULT 8;
