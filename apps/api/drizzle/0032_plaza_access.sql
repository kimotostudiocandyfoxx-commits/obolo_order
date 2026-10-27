DROP INDEX "saturn_plazas_name_idx";--> statement-breakpoint
ALTER TABLE "saturn_plazas" ADD COLUMN "access" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "saturn_plazas_name_idx" ON "saturn_plazas" USING btree ("name") WHERE "saturn_plazas"."access" = 'open';