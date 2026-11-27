-- The first journey is eleven days now (story M-R341, handoff planets-08): after Venus (day 7) the three outer planets
-- are visited before becoming Obolo Order — 8 Pluto / 9 Neptune / 10 Uranus — and the Sun (the Eclipse) moves from day
-- 8 to day 11; 12 = done (ORDER or resident: orderedAt tells them apart).
--
-- The accounts that were already on the old day 8 (the Sun) or past it never go back:
--   old 9 (done)  → 12 (done). Members stay members, residents stay residents; all three planets are open to them.
--   old 8 (the Sun day, playing or finished) → 11 (the Sun day), with journey_completed_at as it was.
--   old 1–7       → unchanged: days 8–10 of now are simply their next days.
-- They are marked `j.eight` in onboarding_json first: they did not visit the three planets on the first journey, so
-- the three days after joining (l2.*, as before) stay theirs. Accounts that play days 8–10 never get those days.
UPDATE "users" SET "onboarding_json" = COALESCE("onboarding_json", '{}'::jsonb) || '{"j.eight":"1"}'::jsonb WHERE "journey_day" >= 8;--> statement-breakpoint
UPDATE "users" SET "journey_day" = CASE
  WHEN "journey_day" >= 9 THEN 12
  WHEN "journey_day" = 8 THEN 11
  ELSE "journey_day" END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "journey_day" SET DEFAULT 12;
