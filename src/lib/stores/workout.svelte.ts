import { browser } from '$app/environment';
import { initDatabase, getClient, getDb } from '$lib/db/client';
import { bands, exercises, workoutSessions, loggedExercises, loggedExerciseBands } from '$lib/db/schema';
import type { Band, Exercise, WorkoutSession, LoggedExercise, WorkoutTemplate } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Template with exercises type
export type TemplateWithExercises = WorkoutTemplate & { exercises: Exercise[] };

// Reactive state
let isInitialized = $state(false);
let allBands = $state<Band[]>([]);
let allExercises = $state<Exercise[]>([]);
let allTemplates = $state<TemplateWithExercises[]>([]);
let currentSession = $state<WorkoutSession | null>(null);
let sessionLogs = $state<(LoggedExercise & { exercise: Exercise; bands: Band[] })[]>([]);
let recentSessions = $state<WorkoutSession[]>([]);
let suggestedExercises = $state<Exercise[]>([]);

// Initialize the database and load initial data
export async function initialize() {
	if (!browser) return;
	if (isInitialized) return;
	
	await initDatabase();
	await refreshBands();
	await refreshExercises();
	await refreshTemplates();
	await refreshRecentSessions();
	isInitialized = true;
}

// Refresh bands from database
export async function refreshBands() {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	const result = await db.select().from(bands).orderBy(bands.resistance);
	allBands = result;
}

// Refresh exercises from database
export async function refreshExercises() {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	const result = await db.select().from(exercises).orderBy(exercises.name);
	allExercises = result;
}

// Refresh templates from database
export async function refreshTemplates() {
	if (!browser) return;
	const client = getClient();
	if (!client) return;
	
	// Get all templates
	const templatesResult = await client.query<{ id: string; name: string; created_at: Date }>(
		`SELECT id, name, created_at FROM workout_templates ORDER BY name`
	);
	
	// Get exercises for each template
	const templatesWithExercises: TemplateWithExercises[] = await Promise.all(
		templatesResult.rows.map(async (template) => {
			const exercisesResult = await client.query<Exercise>(`
				SELECT e.* FROM exercises e
				JOIN workout_template_exercises wte ON e.id = wte.exercise_id
				WHERE wte.template_id = $1
				ORDER BY wte.sort_order
			`, [template.id]);
			
			return {
				id: template.id,
				name: template.name,
				createdAt: template.created_at,
				exercises: exercisesResult.rows
			};
		})
	);
	
	allTemplates = templatesWithExercises;
}

// Refresh recent sessions
export async function refreshRecentSessions() {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	const result = await db.select().from(workoutSessions).orderBy(desc(workoutSessions.startedAt)).limit(10);
	recentSessions = result;
}

// Add a new band
export async function addBand(name: string, resistance: number, color?: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	await db.insert(bands).values({ name, resistance, color });
	await refreshBands();
}

// Delete a band
export async function deleteBand(id: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	await db.delete(bands).where(eq(bands.id, id));
	await refreshBands();
}

// Add a new exercise
export async function addExercise(name: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	await db.insert(exercises).values({ name });
	await refreshExercises();
}

// Delete an exercise
export async function deleteExercise(id: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	await db.delete(exercises).where(eq(exercises.id, id));
	await refreshExercises();
}

// Start a new workout session
export async function startSession(templateId?: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	const [session] = await db.insert(workoutSessions).values({
		templateId: templateId || null
	}).returning();
	currentSession = session;
	sessionLogs = [];
	
	// If a template was selected, set suggested exercises
	if (templateId) {
		const template = allTemplates.find(t => t.id === templateId);
		if (template) {
			suggestedExercises = template.exercises;
		}
	} else {
		suggestedExercises = [];
	}
	
	return session;
}

// End the current session
export async function endSession() {
	if (!browser) return;
	const db = getDb();
	if (!db || !currentSession) return;
	
	await db.update(workoutSessions)
		.set({ endedAt: new Date() })
		.where(eq(workoutSessions.id, currentSession.id));
	
	currentSession = null;
	sessionLogs = [];
	suggestedExercises = [];
	await refreshRecentSessions();
}

// Log an exercise in the current session
export async function logExercise(
	exerciseId: string,
	selectedBandIds: string[],
	fullReps: number,
	partialReps: number
) {
	if (!browser) return;
	const db = getDb();
	if (!db || !currentSession) return;

	// Insert the logged exercise
	const [logged] = await db.insert(loggedExercises).values({
		sessionId: currentSession.id,
		exerciseId,
		fullReps,
		partialReps
	}).returning();

	// Insert band associations
	if (selectedBandIds.length > 0) {
		await db.insert(loggedExerciseBands).values(
			selectedBandIds.map(bandId => ({
				loggedExerciseId: logged.id,
				bandId
			}))
		);
	}

	// Refresh session logs
	await refreshSessionLogs();
}

// Remove a logged exercise
export async function removeLoggedExercise(logId: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	await db.delete(loggedExercises).where(eq(loggedExercises.id, logId));
	await refreshSessionLogs();
}

// Refresh the current session's logs
export async function refreshSessionLogs() {
	if (!browser) return;
	const client = getClient();
	if (!client || !currentSession) {
		sessionLogs = [];
		return;
	}

	// Get all logged exercises for this session
	const logs = await client.query<{
		id: string;
		session_id: string;
		exercise_id: string;
		full_reps: number;
		partial_reps: number;
		logged_at: Date;
		exercise_name: string;
	}>(`
		SELECT 
			le.id,
			le.session_id,
			le.exercise_id,
			le.full_reps,
			le.partial_reps,
			le.logged_at,
			e.name as exercise_name
		FROM logged_exercises le
		JOIN exercises e ON le.exercise_id = e.id
		WHERE le.session_id = $1
		ORDER BY le.logged_at DESC
	`, [currentSession.id]);

	const enrichedLogs = await Promise.all(
		logs.rows.map(async (row) => {
			// Get bands for this logged exercise
			const bandResult = await client.query<Band>(`
				SELECT b.* FROM bands b
				JOIN logged_exercise_bands leb ON b.id = leb.band_id
				WHERE leb.logged_exercise_id = $1
			`, [row.id]);

			return {
				id: row.id,
				sessionId: row.session_id,
				exerciseId: row.exercise_id,
				fullReps: row.full_reps,
				partialReps: row.partial_reps,
				loggedAt: row.logged_at,
				exercise: {
					id: row.exercise_id,
					name: row.exercise_name,
					createdAt: new Date()
				} as Exercise,
				bands: bandResult.rows as Band[]
			};
		})
	);

	sessionLogs = enrichedLogs;
}

// Resume an existing session
export async function resumeSession(sessionId: string) {
	if (!browser) return;
	const db = getDb();
	if (!db) return;
	
	const [session] = await db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId));
	if (session) {
		currentSession = session;
		await refreshSessionLogs();
	}
}

// Get state accessors
export function getState() {
	return {
		get isInitialized() { return isInitialized; },
		get bands() { return allBands; },
		get exercises() { return allExercises; },
		get templates() { return allTemplates; },
		get currentSession() { return currentSession; },
		get sessionLogs() { return sessionLogs; },
		get recentSessions() { return recentSessions; },
		get suggestedExercises() { return suggestedExercises; }
	};
}
