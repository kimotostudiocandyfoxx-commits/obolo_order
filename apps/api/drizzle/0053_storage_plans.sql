CREATE TABLE "storage_plans" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier_gb" integer,
	"paid_month" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"grace_until" timestamp with time zone,
	"lapsed_at" timestamp with time zone,
	"told_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_plans" ADD CONSTRAINT "storage_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;