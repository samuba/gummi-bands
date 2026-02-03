ALTER TABLE "bands" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logged_exercise_bands" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logged_exercises" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "synced_at" timestamp with time zone;