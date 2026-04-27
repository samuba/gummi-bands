ALTER TABLE "bands" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "bands_name_key_unique_idx" ON "bands" USING btree ("name_key") WHERE "bands"."name_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_name_key_unique_idx" ON "exercises" USING btree ("name_key") WHERE "exercises"."name_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_name_key_unique_idx" ON "workout_templates" USING btree ("name_key") WHERE "workout_templates"."name_key" is not null;