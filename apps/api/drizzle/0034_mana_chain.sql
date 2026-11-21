ALTER TABLE "mana_ledger" ADD COLUMN "seq" integer;--> statement-breakpoint
ALTER TABLE "mana_ledger" ADD COLUMN "prev_hash" text;--> statement-breakpoint
ALTER TABLE "mana_ledger" ADD COLUMN "hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "mana_ledger_user_seq_uq" ON "mana_ledger" USING btree ("user_id","seq");--> statement-breakpoint
-- rows written before the chain: number them per user in the order they were written (their hash comes when first sealed)
UPDATE "mana_ledger" AS m SET "seq" = o.n FROM (SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "created_at", "id") AS n FROM "mana_ledger") AS o WHERE m."id" = o."id";
