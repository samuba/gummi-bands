import { browser } from '$app/environment';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { bands, exercises, workoutTemplates, workoutTemplateExercises } from './schema';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, count } from 'drizzle-orm';
import { migrate } from './migrate';


let pglite: PGlite | null = null;
let db: PgliteDatabase<typeof schema> & { $client: PGlite } | null = null;
let initPromise: Promise<void> | null = null;

export async function initDatabase() {
	if (!browser) return;
	
	if (initPromise) return initPromise;

	initPromise = (async () => {
		pglite = new PGlite('idb://gummi-bands-db');
		db = drizzle(pglite, { schema, casing: 'snake_case' });

		await migrate(db);
		await seedData();
	})();
	
	return initPromise;
}

async function seedData() {
	if (!db) return;

	// Seed default bands if none exist
	const [bandCount] = await db.select({ count: count() }).from(bands);
	if (bandCount.count === 0) {
		await db.insert(bands).values([
			{ name: 'Yellow - X-Light', resistance: 5, color: '#FFD700' },
			{ name: 'Red - Light', resistance: 10, color: '#FF4444' },
			{ name: 'Green - Medium', resistance: 15, color: '#44BB44' },
			{ name: 'Blue - Heavy', resistance: 20, color: '#4488FF' },
			{ name: 'Black - X-Heavy', resistance: 25, color: '#333333' },
			{ name: 'Purple - XX-Heavy', resistance: 30, color: '#8844AA' }
		]);
	}

	// Seed default exercises if none exist
	const [exerciseCount] = await db.select({ count: count() }).from(exercises);
	if (exerciseCount.count === 0) {
		await db.insert(exercises).values([
			{ name: 'Chest Press' },
			{ name: 'Chest Press (Pec Crossover)' },
			{ name: 'Overhead Press' },
			{ name: 'Tricep Press' },
			{ name: 'Squat (Front)' },
			{ name: 'Deadlift' },
			{ name: 'Bicep Curl' },
			{ name: 'Row (Bent)' },
			{ name: 'Calf Raise' },
			{ name: 'Lateral Raises' },
			{ name: 'Lunges' },
			{ name: 'Leg Curls' }
		]);
	} else {
		// Ensure required exercises for templates exist
		const requiredExercises = [
			'Chest Press', 'Chest Press (Pec Crossover)', 'Overhead Press', 'Tricep Press', 'Squat (Front)',
			'Deadlift', 'Bicep Curl', 'Row (Bent)', 'Calf Raise'
		];
		for (const name of requiredExercises) {
			const existing = await db.select({ id: exercises.id }).from(exercises).where(eq(exercises.name, name));
			if (existing.length === 0) {
				await db.insert(exercises).values({ name });
			}
		}
	}

	// Seed default workout templates and their exercises
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

	for (const templateDef of templateDefinitions) {
		// Check if template exists
		const existingTemplate = await db
			.select({ id: workoutTemplates.id })
			.from(workoutTemplates)
			.where(eq(workoutTemplates.name, templateDef.name));

		let templateId: string;
		if (existingTemplate.length === 0) {
			// Create template
			const [inserted] = await db
				.insert(workoutTemplates)
				.values({ name: templateDef.name })
				.returning({ id: workoutTemplates.id });
			templateId = inserted.id;
		} else {
			templateId = existingTemplate[0].id;
		}

		// Link any missing exercises to template
		for (let i = 0; i < templateDef.exercises.length; i++) {
			const exerciseResult = await db
				.select({ id: exercises.id })
				.from(exercises)
				.where(eq(exercises.name, templateDef.exercises[i]));

			if (exerciseResult[0]) {
				// Check if this specific exercise is already linked
				const linkExists = await db
					.select({ id: workoutTemplateExercises.id })
					.from(workoutTemplateExercises)
					.where(
						and(
							eq(workoutTemplateExercises.templateId, templateId),
							eq(workoutTemplateExercises.exerciseId, exerciseResult[0].id)
						)
					);

				if (linkExists.length === 0) {
					await db.insert(workoutTemplateExercises).values({
						templateId,
						exerciseId: exerciseResult[0].id,
						sortOrder: i
					});
				}
			}
		}
	}
}


// Export getters for the client and db
export function getClient() {
	return pglite;
}

export function getDb() {
	return db;
}

export { pglite, db };
