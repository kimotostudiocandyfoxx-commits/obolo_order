CREATE TABLE "planet_homes" (
	"user_id" uuid NOT NULL,
	"planet" text NOT NULL,
	"last_visit_at" timestamp with time zone,
	"order_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planet_homes_user_id_planet_pk" PRIMARY KEY("user_id","planet")
);
--> statement-breakpoint
ALTER TABLE "planet_homes" ADD CONSTRAINT "planet_homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;