CREATE TABLE "cast_choices" (
	"user_id" uuid NOT NULL,
	"what" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cast_choices_user_id_what_key_pk" PRIMARY KEY("user_id","what","key")
);
--> statement-breakpoint
CREATE TABLE "story_first_works" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"work_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_first_works_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "cast_choices" ADD CONSTRAINT "cast_choices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_first_works" ADD CONSTRAINT "story_first_works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;