import { browser } from '$app/environment';
import type { PGlite } from '@electric-sql/pglite';

let client: PGlite | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let initPromise: Promise<void> | null = null;

// Initialize database only in browser
async function createClient() {
	if (!browser) return;
	if (client) return;

	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	const schema = await import('./schema');

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

			CREATE TABLE IF NOT EXISTS workout_sessions (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
				logged_at TIMESTAMP DEFAULT NOW() NOT NULL
			);

			CREATE TABLE IF NOT EXISTS logged_exercise_bands (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				logged_exercise_id UUID NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
				band_id UUID NOT NULL REFERENCES bands(id)
			);
		`);

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
				('Bicep Curls'),
				('Tricep Extensions'),
				('Shoulder Press'),
				('Lateral Raises'),
				('Chest Press'),
				('Rows'),
				('Squats'),
				('Deadlifts'),
				('Lunges'),
				('Leg Curls');
			`);
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
