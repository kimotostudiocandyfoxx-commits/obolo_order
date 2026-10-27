-- The first journey is eight days now (story draft 21, M-R124): Venus joins as day 7 and the Sun moves to
-- day 8, where the Eclipse is a choice (accept it, or stay a resident for free). 1 Earth / 2 Moon /
-- 3 Saturn / 4 Jupiter / 5 Mercury / 6 Mars / 7 Venus / 8 Earth → the Sun / 9 done (ORDER or resident:
-- orderedAt tells them apart). The old day 7 (the Eclipse day) becomes day 8; the old 8 (ORDER) becomes 9.
UPDATE "users" SET "journey_day" = CASE
  WHEN "journey_day" >= 8 THEN 9
  WHEN "journey_day" = 7 THEN 8
  ELSE "journey_day" END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "journey_day" SET DEFAULT 9;
