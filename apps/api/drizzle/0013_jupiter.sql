CREATE TABLE "jupiter_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"root_id" uuid,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"poster_url" text,
	"text" text DEFAULT '' NOT NULL,
	"filter" text DEFAULT 'none' NOT NULL,
	"branch" integer DEFAULT 0 NOT NULL,
	"star_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jupiter_roots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_id" uuid,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"poster_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "butterfly_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jupiter_branches" jsonb;--> statement-breakpoint
ALTER TABLE "jupiter_posts" ADD CONSTRAINT "jupiter_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jupiter_posts" ADD CONSTRAINT "jupiter_posts_root_id_jupiter_roots_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."jupiter_roots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jupiter_roots" ADD CONSTRAINT "jupiter_roots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jupiter_roots" ADD CONSTRAINT "jupiter_roots_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jupiter_posts_created_idx" ON "jupiter_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jupiter_posts_user_idx" ON "jupiter_posts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jupiter_roots_user_idx" ON "jupiter_roots" USING btree ("user_id","created_at");