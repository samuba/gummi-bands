import { and, count, eq } from "drizzle-orm";
import * as s from './schema';
import type { Db } from "./client";

export async function seedData(db: Db) {
	if (!db) return;

	// Seed default bands if none exist
	const [bandCount] = await db.select({ count: count() }).from(s.bands);
	if (bandCount.count === 0) {
		await db.insert(s.bands).values([
			{ name: 'Yellow - X-Light', resistance: 5, color: '#FFD700' },
			{ name: 'Red - Light', resistance: 10, color: '#FF4444' },
			{ name: 'Green - Medium', resistance: 15, color: '#44BB44' },
			{ name: 'Blue - Heavy', resistance: 20, color: '#4488FF' },
			{ name: 'Black - X-Heavy', resistance: 25, color: '#333333' },
			{ name: 'Purple - XX-Heavy', resistance: 30, color: '#8844AA' }
		]);
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
		await db.insert(s.exercises).values([
			...templateDefinitions.flatMap(template => template.exercises.map(exercise => ({ name: exercise }))),
		]);
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