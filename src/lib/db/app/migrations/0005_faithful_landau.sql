ALTER TABLE "exercises" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;