ALTER TABLE "app_bands" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "app_exercises" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "app_workout_templates" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "app_workout_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "app_bands_user_id_name_key_unique_idx" ON "app_bands" USING btree ("user_id","name_key") WHERE "app_bands"."name_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "app_exercises_user_id_name_key_unique_idx" ON "app_exercises" USING btree ("user_id","name_key") WHERE "app_exercises"."name_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "app_workout_templates_user_id_name_key_unique_idx" ON "app_workout_templates" USING btree ("user_id","name_key") WHERE "app_workout_templates"."name_key" is not null;