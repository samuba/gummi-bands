ALTER TABLE "workout_sessions" ALTER COLUMN "planned_exercises" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "workout_sessions" ALTER COLUMN "planned_exercises" SET DEFAULT '{}'::text[];