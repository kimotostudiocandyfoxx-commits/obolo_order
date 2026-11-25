CREATE TABLE "fx_rates" (
	"month" text PRIMARY KEY NOT NULL,
	"usd_jpy" double precision NOT NULL,
	"note" text,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gen_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"job" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"seconds" double precision DEFAULT 0 NOT NULL,
	"cost_jpy" double precision NOT NULL,
	"fx" double precision NOT NULL,
	"exact" boolean DEFAULT false NOT NULL,
	"units" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "make_cost_estimates" (
	"kind" text PRIMARY KEY NOT NULL,
	"cost_jpy" double precision NOT NULL,
	"samples" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_accruals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pending_jpy" double precision DEFAULT 0 NOT NULL,
	"taken_mana" integer DEFAULT 0 NOT NULL,
	"absorbed_mana" integer DEFAULT 0 NOT NULL,
	"absorbed_jpy" double precision DEFAULT 0 NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_accruals" ADD CONSTRAINT "usage_accruals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gen_costs_kind_idx" ON "gen_costs" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "gen_costs_user_idx" ON "gen_costs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "gen_costs_job_idx" ON "gen_costs" USING btree ("job");