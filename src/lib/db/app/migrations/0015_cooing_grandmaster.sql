ALTER TABLE "bands" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "seed_slug" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "seed_slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bands_seed_slug_unique_idx" ON "bands" USING btree ("seed_slug") WHERE "bands"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_seed_slug_unique_idx" ON "exercises" USING btree ("seed_slug") WHERE "exercises"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_template_exercises_seed_slug_unique_idx" ON "workout_template_exercises" USING btree ("seed_slug") WHERE "workout_template_exercises"."seed_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_seed_slug_unique_idx" ON "workout_templates" USING btree ("seed_slug") WHERE "workout_templates"."seed_slug" is not null;