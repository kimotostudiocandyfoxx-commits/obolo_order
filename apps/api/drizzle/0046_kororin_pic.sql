ALTER TABLE "users" ADD COLUMN "kororin_pic" integer;--> statement-breakpoint
-- M-R275: a kororin chosen before (M-R266, one of 8 colours) becomes the nearest of the 24 pictures
UPDATE "users" SET "kororin_pic" = CASE "kororin_colour" WHEN 'pearl' THEN 8 WHEN 'gold' THEN 13 WHEN 'pink' THEN 6 WHEN 'mint' THEN 4 WHEN 'lavender' THEN 21 WHEN 'sky' THEN 10 WHEN 'peach' THEN 5 WHEN 'night' THEN 7 END WHERE "kororin_colour" IS NOT NULL AND "kororin_pic" IS NULL;
