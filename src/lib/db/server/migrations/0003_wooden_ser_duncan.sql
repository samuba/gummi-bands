ALTER TABLE "app_logged_exercise_bands" ALTER COLUMN "logged_exercise_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_logged_exercise_bands" ALTER COLUMN "band_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_logged_exercises" ALTER COLUMN "session_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_logged_exercises" ALTER COLUMN "exercise_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_workout_sessions" ALTER COLUMN "template_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_workout_template_exercises" ALTER COLUMN "template_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_workout_template_exercises" ALTER COLUMN "exercise_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_logged_exercise_bands" ADD CONSTRAINT "app_logged_exercise_bands_logged_exercise_id_app_logged_exercises_id_fk" FOREIGN KEY ("logged_exercise_id") REFERENCES "public"."app_logged_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_logged_exercise_bands" ADD CONSTRAINT "app_logged_exercise_bands_band_id_app_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."app_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_logged_exercises" ADD CONSTRAINT "app_logged_exercises_session_id_app_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."app_workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_logged_exercises" ADD CONSTRAINT "app_logged_exercises_exercise_id_app_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."app_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_workout_sessions" ADD CONSTRAINT "app_workout_sessions_template_id_app_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."app_workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_workout_template_exercises" ADD CONSTRAINT "app_workout_template_exercises_template_id_app_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."app_workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_workout_template_exercises" ADD CONSTRAINT "app_workout_template_exercises_exercise_id_app_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."app_exercises"("id") ON DELETE cascade ON UPDATE no action;