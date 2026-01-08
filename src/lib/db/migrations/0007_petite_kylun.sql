ALTER TABLE "bands" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "logged_exercise_bands" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "logged_exercises" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "workout_sessions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();--> statement-breakpoint
ALTER TABLE "workout_templates" ALTER COLUMN "id" SET DEFAULT uuid_generate_v7();