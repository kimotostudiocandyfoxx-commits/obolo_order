CREATE TABLE "item_marks" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"mark" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_marks_user_id_kind_target_id_pk" PRIMARY KEY("user_id","kind","target_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mark_names_json" jsonb;--> statement-breakpoint
ALTER TABLE "item_marks" ADD CONSTRAINT "item_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;