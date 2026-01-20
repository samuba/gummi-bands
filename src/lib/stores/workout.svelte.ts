import { browser } from '$app/environment';
import { SvelteDate } from 'svelte/reactivity';
import { initDatabase, db, isForeignKeyViolation, liveQuery } from '$lib/db/client';
import * as s from '$lib/db/schema';
import type {
	Band,
	Exercise,
	WorkoutSession,
	LoggedExercise,
	WorkoutTemplate
} from '$lib/db/schema';
import { eq, desc, and, ne, asc, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import { loader } from './initialLoader.svelte';
import { settings } from './settings.svelte';

// Reactive state
let isInitialized = $state(false);
let allBands = $state<Band[]>([]);
let allExercises = $state<Exercise[]>([]);
let allTemplates = $state<TemplateWithExercises[]>([]);
let currentSession = $state<WorkoutSession | null>(null);
let sessionLogs = $state<(LoggedExercise & { exercise: Exercise; bands: Band[] })[]>([]);
let recentSessions = $state<WorkoutSession[]>([]);
let suggestedExercises = $state<Exercise[]>([]);

const workoutStats = $state({
	totalSessions: 0,
	thisWeekSessions: 0,
	totalReps: 0,
	totalVolume: 0,
	topExercise: 'None'
});

// Initialize the database and load initial data
export async function initialize() {
	if (!browser) return;
	if (isInitialized) return;

	await initDatabase();

	loader.setLoading('Loading data...', 85);
	// Initialize settings
	await settings.initialize();

	// set allBands
	await liveQuery(
		db.query.bands.findMany({ orderBy: desc(s.bands.createdAt), where: isNull(s.bands.deletedAt) }),
		(rows) => {
			allBands = rows;
			refreshStats()
		}
	);

	// set allExercises
	await liveQuery(
		db.query.exercises.findMany({ orderBy: desc(s.exercises.createdAt), where: isNull(s.exercises.deletedAt) }),
		(rows) => {
			allExercises = rows;
			refreshStats()
		}
	);

	// set workoutSessions
	await liveQuery(
		db.query.workoutSessions.findMany({ orderBy: desc(s.workoutSessions.startedAt), limit: 10 }),
		(rows) => {
			recentSessions = rows;
			refreshStats()
		}
	);

	await liveQuery(
		db.query.workoutTemplates.findMany({
			orderBy: asc(s.workoutTemplates.sortOrder),
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
				updatedAt: template.updatedAt,
				icon: template.icon,
				sortOrder: template.sortOrder,
				exercises: template.workoutTemplateExercises
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map((wte) => wte.exercise)
					.filter((exercise): exercise is Exercise => exercise != null)
			}));
		}
	);

	// set allTemplates with their exercises using select and joins
	await refreshTemplates();

	loader.setLoading('Ready!', 100);
	isInitialized = true;
}

async function refreshStats() {
	if (!browser || !db) return;

	// Total sessions
	const allSessions = await db.select().from(s.workoutSessions);
	workoutStats.totalSessions = allSessions.length;

	// This week sessions (starting Monday)
	const now = new SvelteDate();
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
	const monday = new SvelteDate();
	monday.setDate(diff);
	monday.setHours(0, 0, 0, 0);
	
	workoutStats.thisWeekSessions = allSessions.filter(
		(session) => new Date(session.startedAt) >= monday
	).length;

	// Total reps and top exercise
	const logs = await db.query.loggedExercises.findMany({
		with: {
			exercise: true
		}
	});

	let totalReps = 0;
	const exerciseCounts: Record<string, number> = {};

	for (const log of logs) {
		totalReps += log.fullReps + log.partialReps;
		const name = log.exercise.name;
		exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
	}

	workoutStats.totalReps = totalReps;

	let topEx = 'None';
	let maxCount = 0;
	for (const [name, count] of Object.entries(exerciseCounts)) {
		if (count > maxCount) {
			maxCount = count;
			topEx = name;
		}
	}
	workoutStats.topExercise = topEx;

	// Total Volume
	const volumeResult = await db
		.select({
			volume: sql<number>`COALESCE(SUM(${s.bands.resistance} * (${s.loggedExercises.fullReps} + ${s.loggedExercises.partialReps})), 0)`
		})
		.from(s.loggedExercises)
		.innerJoin(s.loggedExerciseBands, eq(s.loggedExercises.id, s.loggedExerciseBands.loggedExerciseId))
		.innerJoin(s.bands, eq(s.loggedExerciseBands.bandId, s.bands.id));

	workoutStats.totalVolume = volumeResult[0]?.volume || 0;
}

async function refreshTemplates() {
	// can not use liveQuery() because it does not support `with`
	const rows = await db.query.workoutTemplates.findMany({
		orderBy: asc(s.workoutTemplates.sortOrder),
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
		updatedAt: template.updatedAt,
		icon: template.icon,
		sortOrder: template.sortOrder,
		exercises: template.workoutTemplateExercises
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((wte) => wte.exercise)
			.filter((exercise): exercise is Exercise => exercise != null)
	}));
}

export async function addBand(name: string, resistance: number, color?: string) {
	await db.insert(s.bands).values({ name: `${name} doubled`, resistance: resistance * 2, color });
	await db.insert(s.bands).values({ name, resistance, color });
}

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

export async function updateBand(id: string, name: string, resistance: number, color?: string) {
	await db.update(s.bands).set({ name, resistance, ...(color !== undefined && { color }) }).where(eq(s.bands.id, id));
}

export async function addExercise(name: string) {
	await db.insert(s.exercises).values({ name });
}

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

export async function addTemplate(name: string) {
	// Get the highest sortOrder and add 1
	const templates = await db.select().from(s.workoutTemplates).orderBy(desc(s.workoutTemplates.sortOrder)).limit(1);
	const nextSortOrder = templates.length > 0 ? (templates[0].sortOrder ?? 0) + 1 : 0;
	
	await db.insert(s.workoutTemplates).values({ name, sortOrder: nextSortOrder });
	await refreshTemplates();
}

export async function deleteTemplate(id: string) {
	await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, id));
	await refreshTemplates();
}

export async function updateTemplate(id: string, name: string, exerciseIds: string[]) {
	// Update template name
	await db.update(s.workoutTemplates).set({ name }).where(eq(s.workoutTemplates.id, id));

	// Delete existing exercise associations
	await db.delete(s.workoutTemplateExercises).where(eq(s.workoutTemplateExercises.templateId, id));

	// Insert new exercise associations with sort order
	if (exerciseIds.length > 0) {
		await db.insert(s.workoutTemplateExercises).values(
			exerciseIds.map((exerciseId, index) => ({
				templateId: id,
				exerciseId,
				sortOrder: index
			}))
		);
	}

	await refreshTemplates();
}

export async function moveTemplateUp(id: string) {
	const currentIndex = allTemplates.findIndex((t) => t.id === id);
	if (currentIndex <= 0) return;

	const currentTemplate = allTemplates[currentIndex];
	const previousTemplate = allTemplates[currentIndex - 1];

	// Swap sortOrder values
	await db
		.update(s.workoutTemplates)
		.set({ sortOrder: previousTemplate.sortOrder })
		.where(eq(s.workoutTemplates.id, currentTemplate.id));

	await db
		.update(s.workoutTemplates)
		.set({ sortOrder: currentTemplate.sortOrder })
		.where(eq(s.workoutTemplates.id, previousTemplate.id));

	await refreshTemplates();
}

export async function moveTemplateDown(id: string) {
	const currentIndex = allTemplates.findIndex((t) => t.id === id);
	if (currentIndex < 0 || currentIndex >= allTemplates.length - 1) return;

	const currentTemplate = allTemplates[currentIndex];
	const nextTemplate = allTemplates[currentIndex + 1];

	// Swap sortOrder values
	await db
		.update(s.workoutTemplates)
		.set({ sortOrder: nextTemplate.sortOrder })
		.where(eq(s.workoutTemplates.id, currentTemplate.id));

	await db
		.update(s.workoutTemplates)
		.set({ sortOrder: currentTemplate.sortOrder })
		.where(eq(s.workoutTemplates.id, nextTemplate.id));

	await refreshTemplates();
}

// Start a new workout session
export async function startSession(templateId?: string) {
	let plannedExercises: string[] = [];

	// If a template was selected, get exercises
	if (templateId) {
		const template = allTemplates.find((t) => t.id === templateId);
		if (template) {
			plannedExercises = template.exercises.map((e) => e.id);
		}
	}

	const [session] = await db
		.insert(s.workoutSessions)
		.values({ 
			templateId: templateId || null,
			plannedExercises
		})
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

	await refreshSessionLogs();
}

// Remove a logged exercise
export async function removeLoggedExercise(logId: string) {
	await db.delete(s.loggedExercises).where(eq(s.loggedExercises.id, logId));
	await refreshSessionLogs();
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
		await refreshSessionLogs();
	}
}

// Add an exercise to the suggested exercises list
export async function addSuggestedExercise(exercise: Exercise) {
	if (!suggestedExercises.some((e) => e.id === exercise.id)) {
		suggestedExercises = [...suggestedExercises, exercise];

		if (currentSession && db) {
			const plannedExercises = suggestedExercises.map((e) => e.id);
			await db
				.update(s.workoutSessions)
				.set({ plannedExercises })
				.where(eq(s.workoutSessions.id, currentSession.id));
		}
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
	const emptySessions = sessions.filter(
		(session) =>
			session.loggedExercises.length === 0 &&
			(!session.notes || session.notes.trim().length === 0) &&
			(!session.plannedExercises || session.plannedExercises.length === 0)
	);

	if (emptySessions.length > 0) {
		// Delete empty sessions in background, but exclude current session
		const idsToDelete = emptySessions
			.map((s) => s.id)
			.filter((id) => !currentSession || id !== currentSession.id);

		if (idsToDelete.length > 0) {
			db.delete(s.workoutSessions)
				.where(inArray(s.workoutSessions.id, idsToDelete))
				.then(() => {
					console.log(`Deleted ${idsToDelete.length} empty sessions`);
				})
				.catch((err) => console.error('Failed to delete empty sessions', err));
		}
	}

	return sessions
		.filter(
			(session) =>
				session.loggedExercises.length > 0 ||
				(session.notes && session.notes.trim().length > 0) ||
				(session.plannedExercises && session.plannedExercises.length > 0)
		)
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
		}));
}

// Get recent sessions with full details
export async function getRecentDetailedSessions(limit: number): Promise<DetailedSession[]> {
	if (!browser || !db) return [];

	// Fetch a few more to account for potentially empty sessions that will be filtered out
	const fetchLimit = limit + 20;

	const sessions = await db.query.workoutSessions.findMany({
		orderBy: desc(s.workoutSessions.startedAt),
		limit: fetchLimit,
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

	const emptySessions = sessions.filter(
		(session) =>
			session.loggedExercises.length === 0 &&
			(!session.notes || session.notes.trim().length === 0) &&
			(!session.plannedExercises || session.plannedExercises.length === 0)
	);

	if (emptySessions.length > 0) {
		// Delete empty sessions in background, but exclude current session
		const idsToDelete = emptySessions
			.map((s) => s.id)
			.filter((id) => !currentSession || id !== currentSession.id);

		if (idsToDelete.length > 0) {
			db.delete(s.workoutSessions)
				.where(inArray(s.workoutSessions.id, idsToDelete))
				.then(() => {
					console.log(`Deleted ${idsToDelete.length} empty sessions`);
				})
				.catch((err) => console.error('Failed to delete empty sessions', err));
		}
	}

	return sessions
		.filter(
			(session) =>
				session.loggedExercises.length > 0 ||
				(session.notes && session.notes.trim().length > 0) ||
				(session.plannedExercises && session.plannedExercises.length > 0)
		)
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
		.slice(0, limit);
}

// Resume/edit an existing session
export async function editSession(sessionId: string) {
	const [session] = await db
		.select()
		.from(s.workoutSessions)
		.where(eq(s.workoutSessions.id, sessionId));
	if (session) {
		currentSession = session;
		await refreshSessionLogs();

		// Build suggested exercises
		// Priority:
		// 1. session.plannedExercises (if valid array and not empty)
		// 2. sessionLogs (fallback for legacy sessions)
		// 3. template (if no logs and no planned exercises - unlikely but possible for empty legacy session)

		if (
			session.plannedExercises &&
			session.plannedExercises.length > 0
		) {
			const plannedIds = session.plannedExercises as string[];
			// Preserve order from plannedExercises
			suggestedExercises = plannedIds
				.map((id) => allExercises.find((e) => e.id === id))
				.filter((e): e is Exercise => e !== undefined);
		} else {
			// Fallback to legacy behavior: logged exercises
			const exerciseIds = sessionLogs.map((log) => log.exerciseId);
			if (exerciseIds.length > 0) {
				suggestedExercises = allExercises.filter((e) => exerciseIds.includes(e.id));
			} else if (session.templateId) {
				// Fallback to template if no logs (e.g. empty legacy session created from template)
				const template = allTemplates.find((t) => t.id === session.templateId);
				if (template) {
					suggestedExercises = template.exercises;
				} else {
					suggestedExercises = [];
				}
			} else {
				suggestedExercises = [];
			}
		}
	}

	return session;
}

// Delete a workout session
export async function deleteSession(sessionId: string) {
	if (!browser || !db) return;
	await db.delete(s.workoutSessions).where(eq(s.workoutSessions.id, sessionId));
	if (currentSession?.id === sessionId) {
		currentSession = null;
		sessionLogs = [];
	}
	await refreshStats();
}

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

// Get the last used date for each template
export async function getTemplateLastUsedDates(): Promise<Array<[string, Date | null]>> {
	if (!browser || !db) return [];

	// Query to get the most recent startedAt for each templateId
	// Using MAX with GROUP BY to get only the latest session per template
	const result = await db
		.select({
			templateId: s.workoutSessions.templateId,
			lastUsed: sql<Date>`MAX(${s.workoutSessions.startedAt})`
		})
		.from(s.workoutSessions)
		.where(
			and(
				isNotNull(s.workoutSessions.templateId),
				isNotNull(s.workoutSessions.endedAt)
			)
		)
		.groupBy(s.workoutSessions.templateId);
	
	// Build the result array with all templates
	const tuples: Array<[string, Date | null]> = [];
	
	// Add all templates (with null for those never used)
	for (const template of allTemplates) {
		const sessionData = result.find(r => r.templateId === template.id);
		const lastUsed = sessionData?.lastUsed ? new Date(sessionData.lastUsed) : null;
		tuples.push([template.id, lastUsed]);
	}

	return tuples;
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
		},
		get stats() {
			return workoutStats;
		}
	};
}

// Template with exercises type
export type TemplateWithExercises = WorkoutTemplate & { exercises: Exercise[] };