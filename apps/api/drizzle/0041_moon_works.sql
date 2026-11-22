CREATE TABLE "moon_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"versions_json" jsonb NOT NULL,
	"active" integer DEFAULT 0 NOT NULL,
	"origin_json" jsonb,
	"materials_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_homecomings" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"told_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_homecomings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eta_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eta_ms" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "late" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_error_code" text;--> statement-breakpoint
ALTER TABLE "moon_works" ADD CONSTRAINT "moon_works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_homecomings" ADD CONSTRAINT "work_homecomings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moon_works_user_idx" ON "moon_works" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_kind_done_idx" ON "jobs" USING btree ("kind","finished_at");