import { browser } from '$app/environment';
import { SvelteDate } from 'svelte/reactivity';
import { initDatabase, db, isForeignKeyViolation, liveQuery } from '$lib/db/app/client';
import * as s from '$lib/db/app/schema';
import type {
	Band,
	Exercise,
	WorkoutSession,
	LoggedExercise,
	WorkoutTemplate
} from '$lib/db/app/schema';
import { eq, desc, and, ne, asc, isNull, isNotNull, max, sql, inArray } from 'drizzle-orm';
import { loader } from './initialLoader.svelte';
import { settings } from './settings.svelte';
import { syncService } from '$lib/services/sync.svelte';

class WorkoutStore {
	// Reactive state
	isInitialized = $state(false);
	allBands = $state<Band[]>([]);
	allExercises = $state<Exercise[]>([]);
	allTemplates = $state<TemplateWithExercises[]>([]);
	currentSession = $state<WorkoutSession | null>(null);
	sessionLogs = $state<(LoggedExercise & { exercise: Exercise; bands: Band[] })[]>([]);
	recentSessions = $state<WorkoutSession[]>([]);
	suggestedExercises = $state<Exercise[]>([]);

	workoutStats = $state({
		totalSessions: 0,
		thisWeekSessions: 0,
		totalReps: 0,
		totalVolume: 0,
		topExercise: 'None'
	});

	// Initialize the database and load initial data
	async initialize() {
		if (!browser) return;
		if (this.isInitialized) return;
		
		await initDatabase();

		loader.setLoading('Loading data...', 85);
		// Initialize settings
		await settings.initialize();

		// set allBands
		await liveQuery(
			db.query.bands.findMany({ orderBy: desc(s.bands.createdAt), where: isNull(s.bands.deletedAt) }),
			(rows) => {
				this.allBands = rows;
				this.refreshStats()
			}
		);

		// set allExercises
		await liveQuery(
			db.query.exercises.findMany({ orderBy: desc(s.exercises.createdAt), where: isNull(s.exercises.deletedAt) }),
			(rows) => {
				this.allExercises = rows;
				this.refreshStats()
			}
		);

		// set workoutSessions
		await liveQuery(
			db.query.workoutSessions.findMany({ orderBy: desc(s.workoutSessions.startedAt), limit: 10 }),
			(rows) => {
				this.recentSessions = rows;
				this.refreshStats()
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
				this.allTemplates = rows.map((template) => ({
					id: template.id,
					name: template.name,
					seedSlug: template.seedSlug,
					createdAt: template.createdAt,
					updatedAt: template.updatedAt,
					icon: template.icon,
					sortOrder: template.sortOrder,
					syncedAt: template.syncedAt,
					exercises: template.workoutTemplateExercises
						.sort((a, b) => a.sortOrder - b.sortOrder)
						.map((wte) => wte.exercise)
						.filter((exercise): exercise is Exercise => exercise != null)
				}));
			}
		);

		// set allTemplates with their exercises using select and joins
		await this.refreshTemplates();

		loader.setLoading('Ready!', 100);
		this.isInitialized = true;

		// Initialize sync service after database is ready
		syncService.initialize();
	}

	async refreshStats() {
		if (!browser || !db) return;

		// Total sessions
		const allSessions = await db.select().from(s.workoutSessions);
		this.workoutStats.totalSessions = allSessions.length;

		// This week sessions (starting Monday)
		const now = new SvelteDate();
		const day = now.getDay();
		const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
		const monday = new SvelteDate();
		monday.setDate(diff);
		monday.setHours(0, 0, 0, 0);

		this.workoutStats.thisWeekSessions = allSessions.filter(
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

		this.workoutStats.totalReps = totalReps;

		let topEx = 'None';
		let maxCount = 0;
		for (const [name, count] of Object.entries(exerciseCounts)) {
			if (count > maxCount) {
				maxCount = count;
				topEx = name;
			}
		}
		this.workoutStats.topExercise = topEx;

		// Total Volume
		const volumeResult = await db
			.select({
				volume: sql<number>`COALESCE(SUM(${s.bands.resistance} * (${s.loggedExercises.fullReps} + ${s.loggedExercises.partialReps})), 0)`
			})
			.from(s.loggedExercises)
			.innerJoin(s.loggedExerciseBands, eq(s.loggedExercises.id, s.loggedExerciseBands.loggedExerciseId))
			.innerJoin(s.bands, eq(s.loggedExerciseBands.bandId, s.bands.id));

		this.workoutStats.totalVolume = volumeResult[0]?.volume || 0;
	}

	async refreshTemplates() {
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
		this.allTemplates = rows.map((template) => ({
			id: template.id,
			name: template.name,
			seedSlug: template.seedSlug,
			createdAt: template.createdAt,
			updatedAt: template.updatedAt,
			icon: template.icon,
			sortOrder: template.sortOrder,
			syncedAt: template.syncedAt,
			exercises: template.workoutTemplateExercises
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((wte) => wte.exercise)
				.filter((exercise): exercise is Exercise => exercise != null)
		}));
	}

	async addBand(name: string, resistance: number, color?: string) {
		await db.insert(s.bands).values({ name: `${name} doubled`, resistance: resistance * 2, color });
		await db.insert(s.bands).values({ name, resistance, color });
		syncService.triggerSync();
	}

	async deleteBand(id: string) {
		const band = await db.query.bands.findFirst({
			where: eq(s.bands.id, id),
			columns: { seedSlug: true }
		});

		// Seeded rows are user-catalog defaults, so hide instead of hard-delete.
		if (band?.seedSlug) {
			await db.update(s.bands).set({ deletedAt: sql`NOW()` }).where(eq(s.bands.id, id));
			syncService.triggerSync();
			return;
		}

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
		syncService.triggerSync();
	}

	async updateBand(id: string, name: string, resistance: number, color?: string) {
		await db.update(s.bands).set({ name, resistance, ...(color !== undefined && { color }) }).where(eq(s.bands.id, id));
		syncService.triggerSync();
	}

	async addExercise(name: string) {
		await db.insert(s.exercises).values({ name });
		syncService.triggerSync();
	}

	async deleteExercise(id: string) {
		const exercise = await db.query.exercises.findFirst({
			where: eq(s.exercises.id, id),
			columns: { seedSlug: true }
		});

		// Seeded rows are user-catalog defaults, so hide instead of hard-delete.
		if (exercise?.seedSlug) {
			await db.update(s.exercises).set({ deletedAt: sql`NOW()` }).where(eq(s.exercises.id, id));
			syncService.triggerSync();
			return;
		}

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
		syncService.triggerSync();
	}

	async addTemplate(name: string) {
		// Get the highest sortOrder and add 1
		const templates = await db.select().from(s.workoutTemplates).orderBy(desc(s.workoutTemplates.sortOrder)).limit(1);
		const nextSortOrder = templates.length > 0 ? (templates[0].sortOrder ?? 0) + 1 : 0;

		await db.insert(s.workoutTemplates).values({ name, sortOrder: nextSortOrder });
		await this.refreshTemplates();
		syncService.triggerSync();
	}

	async deleteTemplate(id: string) {
		await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, id));
		await this.refreshTemplates();
		syncService.triggerSync();
	}

	async updateTemplate(id: string, name: string, exerciseIds: string[]) {
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

		await this.refreshTemplates();
		syncService.triggerSync();
	}

	async moveTemplateUp(id: string) {
		const currentIndex = this.allTemplates.findIndex((t) => t.id === id);
		if (currentIndex <= 0) return;

		const currentTemplate = this.allTemplates[currentIndex];
		const previousTemplate = this.allTemplates[currentIndex - 1];

		// Swap sortOrder values
		await db
			.update(s.workoutTemplates)
			.set({ sortOrder: previousTemplate.sortOrder })
			.where(eq(s.workoutTemplates.id, currentTemplate.id));

		await db
			.update(s.workoutTemplates)
			.set({ sortOrder: currentTemplate.sortOrder })
			.where(eq(s.workoutTemplates.id, previousTemplate.id));

		await this.refreshTemplates();
		syncService.triggerSync();
	}

	async moveTemplateDown(id: string) {
		const currentIndex = this.allTemplates.findIndex((t) => t.id === id);
		if (currentIndex < 0 || currentIndex >= this.allTemplates.length - 1) return;

		const currentTemplate = this.allTemplates[currentIndex];
		const nextTemplate = this.allTemplates[currentIndex + 1];

		// Swap sortOrder values
		await db
			.update(s.workoutTemplates)
			.set({ sortOrder: nextTemplate.sortOrder })
			.where(eq(s.workoutTemplates.id, currentTemplate.id));

		await db
			.update(s.workoutTemplates)
			.set({ sortOrder: currentTemplate.sortOrder })
			.where(eq(s.workoutTemplates.id, nextTemplate.id));

		await this.refreshTemplates();
		syncService.triggerSync();
	}

	// Start a new workout session
	async startSession(templateId?: string) {
		let plannedExercises: string[] = [];

		// If a template was selected, get exercises
		if (templateId) {
			const template = this.allTemplates.find((t) => t.id === templateId);
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
		this.currentSession = session;
		this.sessionLogs = [];

		// If a template was selected, set suggested exercises
		if (templateId) {
			const template = this.allTemplates.find((t) => t.id === templateId);
			if (template) {
				this.suggestedExercises = template.exercises;
			}
		} else {
			this.suggestedExercises = [];
		}

		syncService.triggerSync();
		return session;
	}

	// End the current session
	async endSession(notes?: string) {
		if (!browser || !db || !this.currentSession) return;

		await db
			.update(s.workoutSessions)
			.set({ endedAt: sql`NOW()`, notes: notes || null })
			.where(eq(s.workoutSessions.id, this.currentSession.id));

		this.currentSession = null;
		this.sessionLogs = [];
		this.suggestedExercises = [];
		syncService.triggerSync();
	}

	// Log an exercise in the current session
	async logExercise(
		exerciseId: string,
		selectedBandIds: string[],
		fullReps: number,
		partialReps: number,
		notes?: string
	) {
		if (!browser || !db || !this.currentSession) return;

		// Insert the logged exercise
		const [logged] = await db
			.insert(s.loggedExercises)
			.values({
				sessionId: this.currentSession.id,
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

		await this.refreshSessionLogs();
		syncService.triggerSync();
	}

	// Remove a logged exercise
	async removeLoggedExercise(logId: string) {
		await db.delete(s.loggedExercises).where(eq(s.loggedExercises.id, logId));
		await this.refreshSessionLogs();
		syncService.triggerSync();
	}

	// Refresh the current session's logs
	async refreshSessionLogs() {
		if (!browser || !db || !this.currentSession) {
			this.sessionLogs = [];
			return;
		}

		// Get all logged exercises for this session with exercise and bands
		const logs = await db.query.loggedExercises.findMany({
			where: eq(s.loggedExercises.sessionId, this.currentSession.id),
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
		this.sessionLogs = logs.map((log) => ({
			id: log.id,
			sessionId: log.sessionId,
			exerciseId: log.exerciseId,
			fullReps: log.fullReps,
			partialReps: log.partialReps,
			notes: log.notes,
			loggedAt: log.loggedAt,
			syncedAt: log.syncedAt,
			exercise: log.exercise,
			bands: log.loggedExerciseBands.map((leb) => leb.band)
		}));
	}

	// Resume an existing session
	async resumeSession(sessionId: string) {
		const session = await db.query.workoutSessions.findFirst({
			where: eq(s.workoutSessions.id, sessionId)
		});
		if (session) {
			this.currentSession = session;
			await this.refreshSessionLogs();
		}
	}

	// Add an exercise to the suggested exercises list
	async addSuggestedExercise(exercise: Exercise) {
		if (!this.suggestedExercises.some((e) => e.id === exercise.id)) {
			this.suggestedExercises = [...this.suggestedExercises, exercise];

			if (this.currentSession && db) {
				const plannedExercises = this.suggestedExercises.map((e) => e.id);
				await db
					.update(s.workoutSessions)
					.set({ plannedExercises })
					.where(eq(s.workoutSessions.id, this.currentSession.id));
				syncService.triggerSync();
			}
		}
	}

	// Get previous exercise data (most recent log for this exercise)
	getPreviousExerciseData = async (exerciseId: string): Promise<PreviousExerciseData> => {
		if (!browser || !db) return null;

		// Get the most recent logged exercise for this exercise ID (excluding current session)
		const whereClause = this.currentSession
			? and(
					eq(s.loggedExercises.exerciseId, exerciseId),
					ne(s.loggedExercises.sessionId, this.currentSession.id)
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
	getSessionLogForExercise(exerciseId: string) {
		return this.sessionLogs.find((log) => log.exerciseId === exerciseId);
	}

	// Sort logged exercises by template order when available, otherwise by loggedAt
	sortLoggedExercisesByTemplateOrder(session: {
		template?: {
			workoutTemplateExercises?: Array<{
				exerciseId: string;
				sortOrder: number;
			}>;
		} | null;
		loggedExercises: Array<{
			exerciseId: string;
			loggedAt: Date;
			id: string;
			fullReps: number;
			partialReps: number;
			notes: string | null;
			loggedExerciseBands: Array<{
				band: Band;
			}>;
			exercise: Exercise;
		}>;
	}): Array<{
		exerciseId: string;
		loggedAt: Date;
		id: string;
		fullReps: number;
		partialReps: number;
		notes: string | null;
		loggedExerciseBands: Array<{
			band: Band;
		}>;
		exercise: Exercise;
	}> {
		let sortedLoggedExercises = session.loggedExercises;

		if (session.template?.workoutTemplateExercises) {
			// Create a map of exerciseId to sortOrder from template
			const templateOrder = new Map(
				session.template.workoutTemplateExercises.map((wte) => [
					wte.exerciseId,
					wte.sortOrder
				])
			);

			// Sort logged exercises by template sortOrder, then by loggedAt as tiebreaker
			sortedLoggedExercises = [...session.loggedExercises].sort((a, b) => {
				const aOrder = templateOrder.get(a.exerciseId) ?? 9999;
				const bOrder = templateOrder.get(b.exerciseId) ?? 9999;

				if (aOrder !== bOrder) {
					return aOrder - bOrder;
				}

				// Tiebreaker: sort by loggedAt time
				return new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime();
			});
		} else {
			// No template: sort by loggedAt time (current behavior)
			sortedLoggedExercises = [...session.loggedExercises].sort(
				(a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
			);
		}

		return sortedLoggedExercises;
	}

	// Get all sessions with full details for history view
	async getDetailedSessionHistory(): Promise<DetailedSession[]> {
		if (!browser || !db) return [];

		// Get all sessions with template and logged exercises using relational query
		const sessions = await db.query.workoutSessions.findMany({
			orderBy: desc(s.workoutSessions.startedAt),
			with: {
				template: {
					with: {
						workoutTemplateExercises: {
							orderBy: asc(s.workoutTemplateExercises.sortOrder),
							with: {
								exercise: true
							}
						}
					}
				},
				loggedExercises: {
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
				.filter((id) => !this.currentSession || id !== this.currentSession.id);

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
			.map((session) => {
				const sortedLoggedExercises = this.sortLoggedExercisesByTemplateOrder(session);

				return {
					id: session.id,
					templateId: session.templateId,
					templateName: session.template?.name ?? null,
					startedAt: session.startedAt,
					endedAt: session.endedAt,
					notes: session.notes,
					logs: sortedLoggedExercises.map((log) => ({
						id: log.id,
						exerciseId: log.exerciseId,
						exerciseName: log.exercise.name,
						fullReps: log.fullReps,
						partialReps: log.partialReps,
						notes: log.notes,
						bands: log.loggedExerciseBands.map((leb) => leb.band)
					}))
				};
			});
	}

	// Get recent sessions with full details
	async getRecentDetailedSessions(limit: number): Promise<DetailedSession[]> {
		if (!browser || !db) return [];

		// Fetch a few more to account for potentially empty sessions that will be filtered out
		const fetchLimit = limit + 20;

		const sessions = await db.query.workoutSessions.findMany({
			orderBy: desc(s.workoutSessions.startedAt),
			limit: fetchLimit,
			with: {
				template: {
					with: {
						workoutTemplateExercises: {
							orderBy: asc(s.workoutTemplateExercises.sortOrder),
							with: {
								exercise: true
							}
						}
					}
				},
				loggedExercises: {
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
				.filter((id) => !this.currentSession || id !== this.currentSession.id);

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
			.map((session) => {
				const sortedLoggedExercises = this.sortLoggedExercisesByTemplateOrder(session);

				return {
					id: session.id,
					templateId: session.templateId,
					templateName: session.template?.name ?? null,
					startedAt: session.startedAt,
					endedAt: session.endedAt,
					notes: session.notes,
					logs: sortedLoggedExercises.map((log) => ({
						id: log.id,
						exerciseId: log.exerciseId,
						exerciseName: log.exercise.name,
						fullReps: log.fullReps,
						partialReps: log.partialReps,
						notes: log.notes,
						bands: log.loggedExerciseBands.map((leb) => leb.band)
					}))
				};
			})
			.slice(0, limit);
	}

	// Resume/edit an existing session
	async editSession(sessionId: string) {
		const [session] = await db
			.select()
			.from(s.workoutSessions)
			.where(eq(s.workoutSessions.id, sessionId));
		if (session) {
			this.currentSession = session;
			await this.refreshSessionLogs();

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
				this.suggestedExercises = plannedIds
					.map((id) => this.allExercises.find((e) => e.id === id))
					.filter((e): e is Exercise => e !== undefined);
			} else {
				// Fallback to legacy behavior: logged exercises
				const exerciseIds = this.sessionLogs.map((log) => log.exerciseId);
				if (exerciseIds.length > 0) {
					this.suggestedExercises = this.allExercises.filter((e) => exerciseIds.includes(e.id));
				} else if (session.templateId) {
					// Fallback to template if no logs (e.g. empty legacy session created from template)
					const template = this.allTemplates.find((t) => t.id === session.templateId);
					if (template) {
						this.suggestedExercises = template.exercises;
					} else {
						this.suggestedExercises = [];
					}
				} else {
					this.suggestedExercises = [];
				}
			}
		}

		return session;
	}

	// Delete a workout session
	async deleteSession(sessionId: string) {
		if (!browser || !db) return;
		await db.delete(s.workoutSessions).where(eq(s.workoutSessions.id, sessionId));
		if (this.currentSession?.id === sessionId) {
			this.currentSession = null;
			this.sessionLogs = [];
		}
		await this.refreshStats();
		syncService.triggerSync();
	}

	async updateSessionNotes(sessionId: string, notes: string | null) {
		await db.update(s.workoutSessions).set({ notes }).where(eq(s.workoutSessions.id, sessionId));
		syncService.triggerSync();
	}

	// Save and close editing session (without setting endedAt if already set)
	async saveEditedSession(notes?: string) {
		if (!browser || !db || !this.currentSession) return;

		// Only update notes, preserve existing endedAt
		if (notes !== undefined) {
			await db
				.update(s.workoutSessions)
				.set({ notes: notes || null })
				.where(eq(s.workoutSessions.id, this.currentSession.id));
		}

		this.currentSession = null;
		this.sessionLogs = [];
		this.suggestedExercises = [];
		syncService.triggerSync();
	}

	async getTemplateLastUsedDates(): Promise<Array<[string, Date | null]>> {
		if (!browser || !db) return [];

		const result = await db
			.select({
				templateId: s.workoutSessions.templateId,
				lastUsed: max(s.workoutSessions.startedAt)
			})
			.from(s.workoutSessions)
			.where(
				and(
					isNotNull(s.workoutSessions.templateId),
					isNotNull(s.workoutSessions.endedAt)
				)
			)
			.groupBy(s.workoutSessions.templateId);

		const tuples: Array<[string, Date | null]> = [];

		// Add all templates (with null for those never used)
		for (const template of this.allTemplates) {
			const sessionData = result.find(r => r.templateId === template.id);
			tuples.push([template.id, sessionData?.lastUsed ?? null]);
		}

		return tuples;
	}
}

// Get previous exercise data (most recent log for this exercise)
export type PreviousExerciseData = {
	bandIds: string[];
	bandNames: string[];
	fullReps: number;
	partialReps: number;
} | null;

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

// Template with exercises type
export type TemplateWithExercises = WorkoutTemplate & { exercises: Exercise[] };

// Create and export a single instance of the WorkoutStore
export const workout = new WorkoutStore();