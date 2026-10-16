CREATE TABLE "line_voices" (
	"user_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_voices_user_id_hash_pk" PRIMARY KEY("user_id","hash")
);
--> statement-breakpoint
ALTER TABLE "line_voices" ADD CONSTRAINT "line_voices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;