CREATE TABLE "buddy_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"audio_url" text,
	"provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "buddy_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"buddy_name" text NOT NULL,
	"persona_json" jsonb NOT NULL,
	"memory_summary" text,
	"messages_since_summary" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "earnings_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta_jpy" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"source" text NOT NULL,
	"ref_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mana_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage" text NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"data" "bytea",
	"synthetic" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saturn_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"voice_media_id" uuid,
	"voice_audio_url" text NOT NULL,
	"voice_source" text DEFAULT 'recorded' NOT NULL,
	"voice_duration_sec" real,
	"star_count" integer DEFAULT 0 NOT NULL,
	"reply_to_id" uuid,
	"ai_generated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "star_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "star_events_tier" CHECK ("star_events"."tier" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"birthdate" date,
	"country" text DEFAULT 'JP' NOT NULL,
	"locale" text DEFAULT 'ja' NOT NULL,
	"subscription_status" text DEFAULT 'demo' NOT NULL,
	"voice_id" text,
	"virtual_account_no" text,
	"kyc_status" text DEFAULT 'none' NOT NULL,
	"storage_usage_bytes" bigint DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mana_balance" integer DEFAULT 0 NOT NULL,
	"earnings_balance_jpy" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_mana_nonneg" CHECK ("wallets"."mana_balance" >= 0),
	CONSTRAINT "wallets_earnings_nonneg" CHECK ("wallets"."earnings_balance_jpy" >= 0)
);
--> statement-breakpoint
ALTER TABLE "buddy_messages" ADD CONSTRAINT "buddy_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_profiles" ADD CONSTRAINT "buddy_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_ledger" ADD CONSTRAINT "earnings_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mana_ledger" ADD CONSTRAINT "mana_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saturn_posts" ADD CONSTRAINT "saturn_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saturn_posts" ADD CONSTRAINT "saturn_posts_voice_media_id_media_objects_id_fk" FOREIGN KEY ("voice_media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_events" ADD CONSTRAINT "star_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buddy_messages_user_idx" ON "buddy_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "earnings_ledger_idem_uq" ON "earnings_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "earnings_ledger_user_idx" ON "earnings_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mana_ledger_idem_uq" ON "mana_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "mana_ledger_user_idx" ON "mana_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "media_objects_user_idx" ON "media_objects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saturn_posts_created_idx" ON "saturn_posts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "saturn_posts_user_idx" ON "saturn_posts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "star_events_uq" ON "star_events" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_uq" ON "users" USING btree ("handle");