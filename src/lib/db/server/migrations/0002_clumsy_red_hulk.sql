DROP INDEX "app_bands_user_id_seed_slug_unique_idx";--> statement-breakpoint
DROP INDEX "app_exercises_user_id_seed_slug_unique_idx";--> statement-breakpoint
DROP INDEX "app_workout_template_exercises_user_id_seed_slug_unique_idx";--> statement-breakpoint
DROP INDEX "app_workout_templates_user_id_seed_slug_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "app_bands_user_id_seed_slug_unique_idx" ON "app_bands" USING btree ("user_id","seed_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "app_exercises_user_id_seed_slug_unique_idx" ON "app_exercises" USING btree ("user_id","seed_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "app_workout_template_exercises_user_id_seed_slug_unique_idx" ON "app_workout_template_exercises" USING btree ("user_id","seed_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "app_workout_templates_user_id_seed_slug_unique_idx" ON "app_workout_templates" USING btree ("user_id","seed_slug");