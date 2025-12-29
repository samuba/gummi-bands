import { browser } from '$app/environment';
import { initDatabase, db, isForeignKeyViolation, liveQuery } from '$lib/db/client';
import * as s from '$lib/db/schema';
import type {
	Band,
	Exercise,
	WorkoutSession,
	LoggedExercise,
	WorkoutTemplate
} from '$lib/db/schema';
import { eq, desc, and, ne, asc, isNull, sql } from 'drizzle-orm';

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

	// set allBands
	await liveQuery(
		db.query.bands.findMany({ orderBy: asc(s.bands.resistance), where: isNull(s.bands.deletedAt) }),
		(rows) => allBands = rows
	);

	// set allExercises
	await liveQuery(
		db.query.exercises.findMany({ orderBy: desc(s.exercises.createdAt), where: isNull(s.exercises.deletedAt) }),
		(rows) => allExercises = rows
	);

	// set workoutSessions
	await liveQuery(
		db.query.workoutSessions.findMany({
			orderBy: desc(s.workoutSessions.startedAt),
			limit: 10
		}),
		(rows) => recentSessions = rows
	);


	await liveQuery(
		db.query.workoutTemplates.findMany({
			orderBy: asc(s.workoutTemplates.name),
			with: {
				workoutTemplateExercises: {
					with: {
						exercise: true
					}
				}
			}
		}),
		(rows) => {
			// Transform to TemplateWithExercises format
			allTemplates = rows.map((template) => ({
				id: template.id,
				name: template.name,
				createdAt: template.createdAt,
				icon: template.icon,
				exercises: template.workoutTemplateExercises
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map((wte) => wte.exercise)
					.filter((exercise): exercise is Exercise => exercise != null)
			}));
		}
	);

	// set allTemplates with their exercises using select and joins
	await refreshTemplates();

	isInitialized = true;
}

async function refreshTemplates() {
	// can not use liveQuery() because it does not support `with`
	const rows = await db.query.workoutTemplates.findMany({
		orderBy: asc(s.workoutTemplates.name),
		with: {
			workoutTemplateExercises: {
				with: {
					exercise: true
				}
			}
		}
	});
	// Transform to TemplateWithExercises format
	allTemplates = rows.map((template) => ({
		id: template.id,
		name: template.name,
		createdAt: template.createdAt,
		icon: template.icon,
		exercises: template.workoutTemplateExercises
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((wte) => wte.exercise)
			.filter((exercise): exercise is Exercise => exercise != null)
	}));
}

// Add a new band
export async function addBand(name: string, resistance: number, color?: string) {
	await db.insert(s.bands).values({ name, resistance, color });
}

// Delete a band
export async function deleteBand(id: string) {
	try {
		await db.delete(s.bands).where(eq(s.bands.id, id));
	} catch (error) {
		if (isForeignKeyViolation(error)) {
			await db.update(s.bands).set({ deletedAt: sql`NOW()` }).where(eq(s.bands.id, id));
		} else {
			console.error('Failed to delete band:', error);
			throw error;
		}
	}
}


  

// Add a new exercise
export async function addExercise(name: string) {
	await db.insert(s.exercises).values({ name });
}

// Delete an exercise
export async function deleteExercise(id: string) {
	try {
		await db.delete(s.exercises).where(eq(s.exercises.id, id));
	} catch (error) {
		if (isForeignKeyViolation(error)) {
			await db.update(s.exercises).set({ deletedAt: sql`NOW()` }).where(eq(s.exercises.id, id));
		} else {
			console.error('Failed to delete exercise:', error);
			throw error;
		}
	}
}

// Start a new workout session
export async function startSession(templateId?: string) {
	const [session] = await db
		.insert(s.workoutSessions)
		.values({ templateId: templateId || null })
		.returning();
	currentSession = session;
	sessionLogs = [];

	// If a template was selected, set suggested exercises
	if (templateId) {
		const template = allTemplates.find((t) => t.id === templateId);
		if (template) {
			suggestedExercises = template.exercises;
		}
	} else {
		suggestedExercises = [];
	}

	return session;
}

// End the current session
export async function endSession(notes?: string) {
	if (!browser || !db || !currentSession) return;

	await db
		.update(s.workoutSessions)
		.set({ endedAt: sql`NOW()`, notes: notes || null })
		.where(eq(s.workoutSessions.id, currentSession.id));

	currentSession = null;
	sessionLogs = [];
	suggestedExercises = [];
}

// Log an exercise in the current session
export async function logExercise(
	exerciseId: string,
	selectedBandIds: string[],
	fullReps: number,
	partialReps: number,
	notes?: string
) {
	if (!browser || !db || !currentSession) return;

	// Insert the logged exercise
	const [logged] = await db
		.insert(s.loggedExercises)
		.values({
			sessionId: currentSession.id,
			exerciseId,
			fullReps,
			partialReps,
			notes: notes || null
		})
		.returning();

	// Insert band associations
	if (selectedBandIds.length > 0) {
		await db.insert(s.loggedExerciseBands).values(
			selectedBandIds.map((bandId) => ({
				loggedExerciseId: logged.id,
				bandId
			}))
		);
	}
}

// Remove a logged exercise
export async function removeLoggedExercise(logId: string) {
	await db.delete(s.loggedExercises).where(eq(s.loggedExercises.id, logId));
}

// Refresh the current session's logs
export async function refreshSessionLogs() {
	if (!browser || !db || !currentSession) {
		sessionLogs = [];
		return;
	}

	// Get all logged exercises for this session with exercise and bands
	const logs = await db.query.loggedExercises.findMany({
		where: eq(s.loggedExercises.sessionId, currentSession.id),
		orderBy: desc(s.loggedExercises.loggedAt),
		with: {
			exercise: true,
			loggedExerciseBands: {
				with: {
					band: true
				}
			}
		}
	});

	// Transform to expected format
	sessionLogs = logs.map((log) => ({
		id: log.id,
		sessionId: log.sessionId,
		exerciseId: log.exerciseId,
		fullReps: log.fullReps,
		partialReps: log.partialReps,
		notes: log.notes,
		loggedAt: log.loggedAt,
		exercise: log.exercise,
		bands: log.loggedExerciseBands.map((leb) => leb.band)
	}));
}

// Resume an existing session
export async function resumeSession(sessionId: string) {
	const session = await db.query.workoutSessions.findFirst({
		where: eq(s.workoutSessions.id, sessionId)
	});
	if (session) {
		currentSession = session;
	}
}

// Add an exercise to the suggested exercises list
export function addSuggestedExercise(exercise: Exercise) {
	if (!suggestedExercises.some((e) => e.id === exercise.id)) {
		suggestedExercises = [...suggestedExercises, exercise];
	}
}

// Get previous exercise data (most recent log for this exercise)
export type PreviousExerciseData = {
	bandIds: string[];
	bandNames: string[];
	fullReps: number;
	partialReps: number;
} | null;

export async function getPreviousExerciseData(exerciseId: string): Promise<PreviousExerciseData> {
	if (!browser || !db) return null;

	// Get the most recent logged exercise for this exercise ID (excluding current session)
	const whereClause = currentSession
		? and(
				eq(s.loggedExercises.exerciseId, exerciseId),
				ne(s.loggedExercises.sessionId, currentSession.id)
			)
		: eq(s.loggedExercises.exerciseId, exerciseId);

	const log = await db.query.loggedExercises.findFirst({
		where: whereClause,
		orderBy: desc(s.loggedExercises.loggedAt),
		with: {
			loggedExerciseBands: {
				with: {
					band: true
				}
			}
		}
	});

	if (!log) return null;

	return {
		bandIds: log.loggedExerciseBands.map((leb) => leb.band.id),
		bandNames: log.loggedExerciseBands.map((leb) => leb.band.name),
		fullReps: log.fullReps,
		partialReps: log.partialReps
	};
}

// Get current session log for an exercise
export function getSessionLogForExercise(exerciseId: string) {
	return sessionLogs.find((log) => log.exerciseId === exerciseId);
}

// Type for detailed session with all data
export type DetailedSession = {
	id: string;
	templateId: string | null;
	templateName: string | null;
	startedAt: Date;
	endedAt: Date | null;
	notes: string | null;
	logs: {
		id: string;
		exerciseId: string;
		exerciseName: string;
		fullReps: number;
		partialReps: number;
		notes: string | null;
		bands: Band[];
	}[];
};

// Get all sessions with full details for history view
export async function getDetailedSessionHistory(): Promise<DetailedSession[]> {
	if (!browser || !db) return [];

	// Get all sessions with template and logged exercises using relational query
	const sessions = await db.query.workoutSessions.findMany({
		orderBy: desc(s.workoutSessions.startedAt),
		with: {
			template: true,
			loggedExercises: {
				orderBy: asc(s.loggedExercises.loggedAt),
				with: {
					exercise: true,
					loggedExerciseBands: {
						with: {
							band: true
						}
					}
				}
			}
		}
	});

	// Transform to DetailedSession format and filter empty sessions
	return sessions
		.map((session) => ({
			id: session.id,
			templateId: session.templateId,
			templateName: session.template?.name ?? null,
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			notes: session.notes,
			logs: session.loggedExercises.map((log) => ({
				id: log.id,
				exerciseId: log.exerciseId,
				exerciseName: log.exercise.name,
				fullReps: log.fullReps,
				partialReps: log.partialReps,
				notes: log.notes,
				bands: log.loggedExerciseBands.map((leb) => leb.band)
			}))
		}))
		.filter((session) => session.logs.length > 0 || session.notes);
}

// Resume/edit an existing session
export async function editSession(sessionId: string) {
	const [session] = await db
		.select()
		.from(s.workoutSessions)
		.where(eq(s.workoutSessions.id, sessionId));
	if (session) {
		currentSession = session;

		// Build suggested exercises from the session's logged exercises
		const exerciseIds = sessionLogs.map((log) => log.exerciseId);
		suggestedExercises = allExercises.filter((e) => exerciseIds.includes(e.id));
	}

	return session;
}

// Update session notes
export async function updateSessionNotes(sessionId: string, notes: string | null) {
	await db.update(s.workoutSessions).set({ notes }).where(eq(s.workoutSessions.id, sessionId));
}

// Save and close editing session (without setting endedAt if already set)
export async function saveEditedSession(notes?: string) {
	if (!browser || !db || !currentSession) return;

	// Only update notes, preserve existing endedAt
	if (notes !== undefined) {
		await db
			.update(s.workoutSessions)
			.set({ notes: notes || null })
			.where(eq(s.workoutSessions.id, currentSession.id));
	}

	currentSession = null;
	sessionLogs = [];
	suggestedExercises = [];
}

// Get state accessors
export function getState() {
	return {
		get isInitialized() {
			return isInitialized;
		},
		get bands() {
			return allBands;
		},
		get exercises() {
			return allExercises;
		},
		get templates() {
			return allTemplates;
		},
		get currentSession() {
			return currentSession;
		},
		get sessionLogs() {
			return sessionLogs;
		},
		get recentSessions() {
			return recentSessions;
		},
		get suggestedExercises() {
			return suggestedExercises;
		}
	};
}

// Template with exercises type
export type TemplateWithExercises = WorkoutTemplate & { exercises: Exercise[] };