ALTER TABLE "app_settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "app_settings" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "app_bands" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "app_exercises" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "app_workout_template_exercises" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "app_workout_templates" ADD COLUMN "seed_slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "app_bands_user_id_seed_slug_unique_idx" ON "app_bands" USING btree ("user_id","seed_slug") WHERE "app_bands"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "app_exercises_user_id_seed_slug_unique_idx" ON "app_exercises" USING btree ("user_id","seed_slug") WHERE "app_exercises"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "app_workout_template_exercises_user_id_seed_slug_unique_idx" ON "app_workout_template_exercises" USING btree ("user_id","seed_slug") WHERE "app_workout_template_exercises"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "app_workout_templates_user_id_seed_slug_unique_idx" ON "app_workout_templates" USING btree ("user_id","seed_slug") WHERE "app_workout_templates"."seed_slug" is not null;
