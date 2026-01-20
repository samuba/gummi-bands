ALTER TABLE "workout_templates" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

-- Update existing templates with sequential sortOrder based on name (alphabetically)
WITH numbered_templates AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as new_sort_order
  FROM workout_templates
)
UPDATE workout_templates
SET sort_order = numbered_templates.new_sort_order
FROM numbered_templates
WHERE workout_templates.id = numbered_templates.id;