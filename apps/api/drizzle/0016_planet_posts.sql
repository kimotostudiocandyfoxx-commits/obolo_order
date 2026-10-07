CREATE TABLE "planet_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet" text NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"poster_url" text,
	"seconds" real,
	"star_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "planet_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "planet_posts" ADD CONSTRAINT "planet_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_replies" ADD CONSTRAINT "planet_replies_post_id_planet_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."planet_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_replies" ADD CONSTRAINT "planet_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planet_posts_planet_idx" ON "planet_posts" USING btree ("planet","created_at");--> statement-breakpoint
CREATE INDEX "planet_posts_user_idx" ON "planet_posts" USING btree ("user_id","planet","created_at");--> statement-breakpoint
CREATE INDEX "planet_replies_post_idx" ON "planet_replies" USING btree ("post_id","created_at");