import { browser } from '$app/environment';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { PGlite } from '@electric-sql/pglite';

let client: PGlite | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let initPromise: Promise<void> | null = null;

// Initialize database only in browser
async function createClient() {
	// if (!browser) return;
	if (client) return;

	client = new PGlite('idb://gummi-bands-db');
	db = drizzle(client, { schema });
}

// Initialize database schema
export async function initDatabase() {
	if (!browser) return;
	
	if (initPromise) return initPromise;
	
	initPromise = (async () => {
		await createClient();
		if (!client) return;

		await client.exec(`
			CREATE TABLE IF NOT EXISTS bands (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				name TEXT NOT NULL,
				resistance REAL NOT NULL,
				color TEXT,
				created_at TIMESTAMP DEFAULT NOW() NOT NULL
			);

			CREATE TABLE IF NOT EXISTS exercises (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				name TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT NOW() NOT NULL
			);

			CREATE TABLE IF NOT EXISTS workout_templates (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				name TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT NOW() NOT NULL
			);

			CREATE TABLE IF NOT EXISTS workout_template_exercises (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
				exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
				sort_order INTEGER NOT NULL DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS workout_sessions (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				template_id UUID REFERENCES workout_templates(id),
				started_at TIMESTAMP DEFAULT NOW() NOT NULL,
				ended_at TIMESTAMP,
				notes TEXT
			);

			CREATE TABLE IF NOT EXISTS logged_exercises (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
				exercise_id UUID NOT NULL REFERENCES exercises(id),
				full_reps INTEGER NOT NULL DEFAULT 0,
				partial_reps INTEGER NOT NULL DEFAULT 0,
				notes TEXT,
				logged_at TIMESTAMP DEFAULT NOW() NOT NULL
			);

			CREATE TABLE IF NOT EXISTS logged_exercise_bands (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				logged_exercise_id UUID NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
				band_id UUID NOT NULL REFERENCES bands(id)
			);
		`);

		// Migration: Add template_id column to workout_sessions if it doesn't exist
		const columnCheck = await client.query<{ column_name: string }>(`
			SELECT column_name FROM information_schema.columns 
			WHERE table_name = 'workout_sessions' AND column_name = 'template_id'
		`);
		if (columnCheck.rows.length === 0) {
			await client.exec(`
				ALTER TABLE workout_sessions 
				ADD COLUMN template_id UUID REFERENCES workout_templates(id)
			`);
		}

		// Migration: Add notes column to logged_exercises if it doesn't exist
		const notesColumnCheck = await client.query<{ column_name: string }>(`
			SELECT column_name FROM information_schema.columns 
			WHERE table_name = 'logged_exercises' AND column_name = 'notes'
		`);
		if (notesColumnCheck.rows.length === 0) {
			await client.exec(`
				ALTER TABLE logged_exercises 
				ADD COLUMN notes TEXT
			`);
		}

		// Seed default bands if none exist
		const existingBands = await client.query<{ count: number }>('SELECT COUNT(*) as count FROM bands');
		if (Number(existingBands.rows[0].count) === 0) {
			await client.exec(`
				INSERT INTO bands (name, resistance, color) VALUES
				('Yellow - X-Light', 5, '#FFD700'),
				('Red - Light', 10, '#FF4444'),
				('Green - Medium', 15, '#44BB44'),
				('Blue - Heavy', 20, '#4488FF'),
				('Black - X-Heavy', 25, '#333333'),
				('Purple - XX-Heavy', 30, '#8844AA');
			`);
		}

		// Seed default exercises if none exist
		const existingExercises = await client.query<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
		if (Number(existingExercises.rows[0].count) === 0) {
			await client.exec(`
				INSERT INTO exercises (name) VALUES
				('Chest Press'),
				('Chest Press (Pec Crossover)'),
				('Overhead Press'),
				('Tricep Press'),
				('Squat (Front)'),
				('Deadlift'),
				('Bicep Curl'),
				('Row (Bent)'),
				('Calf Raise'),
				('Lateral Raises'),
				('Lunges'),
				('Leg Curls');
			`);
		} else {
			// Ensure required exercises for templates exist
			const requiredExercises = [
				'Chest Press', 'Chest Press (Pec Crossover)', 'Overhead Press', 'Tricep Press', 'Squat (Front)',
				'Deadlift', 'Bicep Curl', 'Row (Bent)', 'Calf Raise'
			];
			for (const name of requiredExercises) {
				const exists = await client.query<{ id: string }>(`SELECT id FROM exercises WHERE name = $1`, [name]);
				if (exists.rows.length === 0) {
					await client.exec(`INSERT INTO exercises (name) VALUES ('${name}')`);
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
			const templateResult = await client.query<{ id: string }>(
				`SELECT id FROM workout_templates WHERE name = $1`,
				[templateDef.name]
			);

			let templateId: string;
			if (templateResult.rows.length === 0) {
				// Create template
				const insertResult = await client.query<{ id: string }>(
					`INSERT INTO workout_templates (name) VALUES ($1) RETURNING id`,
					[templateDef.name]
				);
				templateId = insertResult.rows[0].id;
			} else {
				templateId = templateResult.rows[0].id;
			}

			// Link any missing exercises to template
			for (let i = 0; i < templateDef.exercises.length; i++) {
				const exerciseResult = await client.query<{ id: string }>(
					`SELECT id FROM exercises WHERE name = $1`,
					[templateDef.exercises[i]]
				);
				if (exerciseResult.rows[0]) {
					// Check if this specific exercise is already linked
					const linkExists = await client.query<{ id: string }>(
						`SELECT id FROM workout_template_exercises WHERE template_id = $1 AND exercise_id = $2`,
						[templateId, exerciseResult.rows[0].id]
					);
					if (linkExists.rows.length === 0) {
						await client.query(
							`INSERT INTO workout_template_exercises (template_id, exercise_id, sort_order) VALUES ($1, $2, $3)`,
							[templateId, exerciseResult.rows[0].id, i]
						);
					}
				}
			}
		}
	})();
	
	return initPromise;
}

// Export getters for the client and db
export function getClient() {
	return client;
}

export function getDb() {
	return db;
}

export { client, db };
