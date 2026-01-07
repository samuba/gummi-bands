import { and, count, eq } from "drizzle-orm";
import * as s from './schema';
import type { Db } from "./client";

/** IMPORTANT
 * Always use single inserts instead of bulk inserts to avoid having them all have same createdAt timestamp
 */

export async function seedData(db: Db) {
	if (!db) return;

	// Seed default bands if none exist
	const [bandCount] = await db.select({ count: count() }).from(s.bands);
	if (bandCount.count === 0) {
		const bandsToInsert = [
			{ name: 'White', resistance: 50, color: '#FFFFFF' },
			{ name: 'White doubled', resistance: 100, color: '#FFFFFF' },
			{ name: 'Light Grey', resistance: 80, color: '#D3D3D3' },
			{ name: 'Light Grey doubled', resistance: 160, color: '#D3D3D3' },
			{ name: 'Dark Grey', resistance: 120, color: '#808080' },
			{ name: 'Dark Grey doubled', resistance: 240, color: '#808080' },
			{ name: 'Black', resistance: 150, color: '#000000' },
			{ name: 'Black doubled', resistance: 300, color: '#000000' },
			{ name: 'Elite', resistance: 300, color: '#FF8C00' },
			{ name: 'Elite doubled', resistance: 600, color: '#FF8C00' }
		];
		
		for (const band of bandsToInsert) {
			await db.insert(s.bands).values(band);
		}
	}

	const templateDefinitions = [
		{
			name: 'Push Day',
			exercises: ['Chest Press', 'Chest Press (Pec Crossover)', 'Overhead Press', 'Tricep Press', 'Squat (Front)']
		},
		{
			name: 'Pull Day',
			exercises: ['Deadlift', 'Bicep Curl', 'Row (Bent)', 'Calf Raise']
		}
	];

	// Seed default exercises if none exist
	const [exerciseCount] = await db.select({ count: count() }).from(s.exercises);
	if (exerciseCount.count === 0) {
		const exercisesToInsert = templateDefinitions.flatMap(template => template.exercises.map(exercise => ({ name: exercise })));
		for (const exercise of exercisesToInsert) {
			await db.insert(s.exercises).values(exercise);
		}
	} else {
		// Ensure required exercises for templates exist
		const requiredExercises = templateDefinitions.flatMap(template => template.exercises);
		for (const name of requiredExercises) {
			const existing = await db.query.exercises.findFirst({
				where: eq(s.exercises.name, name),
				columns: { id: true }
			})
			if (!existing) {
				await db.insert(s.exercises).values({ name });
			}
		}
	}

	// Seed default workout templates and their exercises
	for (const templateDef of templateDefinitions) {
		// Check if template exists
		const existingTemplate = await db.query.workoutTemplates.findFirst({
			where: eq(s.workoutTemplates.name, templateDef.name),
			columns: { id: true }
		});

		let templateId: string;
		if (!existingTemplate) {
			// Create template
			const [inserted] = await db
				.insert(s.workoutTemplates)
				.values({ name: templateDef.name })
				.returning({ id: s.workoutTemplates.id });
			templateId = inserted.id;
		} else {
			templateId = existingTemplate.id;
		}

		// Link any missing exercises to template
		for (let i = 0; i < templateDef.exercises.length; i++) {
			const exerciseResult = await db.query.exercises.findFirst({
				where: eq(s.exercises.name, templateDef.exercises[i]),
				columns: { id: true }
			});

			if (exerciseResult) {
				// Check if this specific exercise is already linked
				const linkExists = await db.query.workoutTemplateExercises.findFirst({
					where: and(
						eq(s.workoutTemplateExercises.templateId, templateId),
						eq(s.workoutTemplateExercises.exerciseId, exerciseResult.id)
					),
					columns: { id: true }
				});

				if (!linkExists) {
					await db.insert(s.workoutTemplateExercises).values({
						templateId,
						exerciseId: exerciseResult.id,
						sortOrder: i
					});
				}
			}
		}
	}
}