CREATE TABLE "spell_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"tags_json" jsonb NOT NULL,
	"spell_key" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spell_book" ADD CONSTRAINT "spell_book_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spell_book_user_idx" ON "spell_book" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spell_book_user_key_uq" ON "spell_book" USING btree ("user_id","spell_key");