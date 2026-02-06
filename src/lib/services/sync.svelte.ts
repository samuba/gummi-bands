import { browser } from '$app/environment';
import { db } from '$lib/db/app/client';
import * as s from '$lib/db/app/schema';
import { sessionStore } from '$lib/auth-client';
import { isNull, or, lt, sql } from 'drizzle-orm';

class SyncService {
	// Reactive state
	isOnline = $state(browser ? navigator.onLine : true);
	isSyncing = $state(false);
	lastSyncAt = $state<string | null>(null);
	syncError = $state<string | null>(null);

	// Debounce timer
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly DEBOUNCE_MS = 500;

	// Track if we're initialized
	private initialized = false;

	constructor() {
		if (browser) {
			// Load last sync time from localStorage
			this.lastSyncAt = localStorage.getItem('lastSyncAt');
		}
	}

	// Initialize sync service - call after db is ready
	initialize() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Set up online/offline listeners
		window.addEventListener('online', () => {
			this.isOnline = true;
			this.fullSync();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});

		// Track previous session state to detect login vs page refresh
		let previousUserId: string | null = null;
		let isInitialLoad = true;

		// Watch for session changes to trigger sync on login
		$effect.root(() => {
			$effect(() => {
				const session = sessionStore.value;
				const currentUserId = session?.data?.user?.id ?? null;
				
				// Skip if session is still loading
				if (session?.isPending) return;

				if (currentUserId && this.isOnline) {
					// Sync on: initial page load with logged-in user, or user just logged in
					if (isInitialLoad || (previousUserId !== currentUserId)) {
						this.fullSync();
					}
				}

				previousUserId = currentUserId;
				isInitialLoad = false;
			});
		});
	}

	// Trigger a debounced sync after write operations
	triggerSync() {
		if (!browser || !this.isOnline) return;

		// Only sync if user is logged in
		const session = sessionStore.value;
		if (!session?.data?.user) return;

		// Debounce to avoid too many syncs
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.fullSync();
		}, this.DEBOUNCE_MS);
	}

	// Full bidirectional sync
	async fullSync() {
		if (!browser || !db || this.isSyncing) return;

		// Check if user is logged in
		const session = sessionStore.value;
		if (!session?.data?.user) return;

		this.isSyncing = true;
		this.syncError = null;

		try {
			// 1. Get unsynced local records (where syncedAt IS NULL or syncedAt < updatedAt)
			const unsyncedCondition = (table: { syncedAt: typeof s.bands.syncedAt; updatedAt: typeof s.bands.updatedAt }) =>
				or(isNull(table.syncedAt), lt(table.syncedAt, table.updatedAt));

			const [
				unsyncedBands,
				unsyncedSettings,
				unsyncedExercises,
				unsyncedTemplates,
				unsyncedTemplateExercises,
				unsyncedSessions,
				unsyncedLoggedExercises,
				unsyncedLoggedExerciseBands
			] = await Promise.all([
				db.select().from(s.bands).where(unsyncedCondition(s.bands)),
				db.select().from(s.settings).where(unsyncedCondition(s.settings)),
				db.select().from(s.exercises).where(unsyncedCondition(s.exercises)),
				db.select().from(s.workoutTemplates).where(unsyncedCondition(s.workoutTemplates)),
				db.select().from(s.workoutTemplateExercises).where(isNull(s.workoutTemplateExercises.syncedAt)),
				db.select().from(s.workoutSessions).where(unsyncedCondition(s.workoutSessions)),
				db.select().from(s.loggedExercises).where(isNull(s.loggedExercises.syncedAt)),
				db.select().from(s.loggedExerciseBands).where(isNull(s.loggedExerciseBands.syncedAt))
			]);

			// 2. Push local changes to server
			const hasChangesToPush =
				unsyncedBands.length > 0 ||
				unsyncedSettings.length > 0 ||
				unsyncedExercises.length > 0 ||
				unsyncedTemplates.length > 0 ||
				unsyncedTemplateExercises.length > 0 ||
				unsyncedSessions.length > 0 ||
				unsyncedLoggedExercises.length > 0 ||
				unsyncedLoggedExerciseBands.length > 0;

		if (hasChangesToPush) {
			const pushResponse = await fetch('/api/sync/push', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bands: unsyncedBands.map(b => ({
						...b,
						createdAt: b.createdAt.toISOString(),
						updatedAt: b.updatedAt.toISOString(),
						deletedAt: b.deletedAt?.toISOString() ?? null
					})),
					settings: unsyncedSettings.map(s => ({
						...s,
						updatedAt: s.updatedAt.toISOString()
					})),
					exercises: unsyncedExercises.map(e => ({
						...e,
						createdAt: e.createdAt.toISOString(),
						updatedAt: e.updatedAt.toISOString(),
						deletedAt: e.deletedAt?.toISOString() ?? null
					})),
					workoutTemplates: unsyncedTemplates.map(t => ({
						...t,
						createdAt: t.createdAt.toISOString(),
						updatedAt: t.updatedAt.toISOString()
					})),
					workoutTemplateExercises: unsyncedTemplateExercises,
					workoutSessions: unsyncedSessions.map(s => ({
						...s,
						startedAt: s.startedAt.toISOString(),
						updatedAt: s.updatedAt.toISOString(),
						endedAt: s.endedAt?.toISOString() ?? null
					})),
					loggedExercises: unsyncedLoggedExercises.map(le => ({
						...le,
						loggedAt: le.loggedAt.toISOString()
					})),
					loggedExerciseBands: unsyncedLoggedExerciseBands
				})
			});

			if (!pushResponse.ok) {
				throw new Error(`Push failed: ${pushResponse.status}`);
			}

			const pushResult: PushResponse = await pushResponse.json();

			// 3. Mark pushed records as synced
			await Promise.all([
				unsyncedBands.length > 0 && db.update(s.bands).set({ syncedAt: sql`now()` }).where(unsyncedCondition(s.bands)),
				unsyncedSettings.length > 0 && db.update(s.settings).set({ syncedAt: sql`now()` }).where(unsyncedCondition(s.settings)),
				unsyncedExercises.length > 0 && db.update(s.exercises).set({ syncedAt: sql`now()` }).where(unsyncedCondition(s.exercises)),
				unsyncedTemplates.length > 0 && db.update(s.workoutTemplates).set({ syncedAt: sql`now()` }).where(unsyncedCondition(s.workoutTemplates)),
				unsyncedTemplateExercises.length > 0 && db.update(s.workoutTemplateExercises).set({ syncedAt: sql`now()` }).where(isNull(s.workoutTemplateExercises.syncedAt)),
				unsyncedSessions.length > 0 && db.update(s.workoutSessions).set({ syncedAt: sql`now()` }).where(unsyncedCondition(s.workoutSessions)),
				unsyncedLoggedExercises.length > 0 && db.update(s.loggedExercises).set({ syncedAt: sql`now()` }).where(isNull(s.loggedExercises.syncedAt)),
				unsyncedLoggedExerciseBands.length > 0 && db.update(s.loggedExerciseBands).set({ syncedAt: sql`now()` }).where(isNull(s.loggedExerciseBands.syncedAt))
			]);
		}

		// 4. Pull server changes
		const pullUrl = new URL('/api/sync/pull', window.location.origin);
		if (this.lastSyncAt) {
			pullUrl.searchParams.set('lastSyncAt', this.lastSyncAt);
		}
		const pullResponse = await fetch(pullUrl);

		if (!pullResponse.ok) {
			throw new Error(`Pull failed: ${pullResponse.status}`);
		}

		const pullResult: PullResponse = await pullResponse.json();

		// 5. Apply server changes locally (last-write-wins based on updatedAt)
		await this.applyServerChanges(pullResult);

		// 6. Update lastSyncAt
		this.lastSyncAt = pullResult.syncedAt;
		localStorage.setItem('lastSyncAt', pullResult.syncedAt);

	} catch (err) {
			console.error('Sync failed:', err);
			this.syncError = err instanceof Error ? err.message : 'Sync failed';
		} finally {
			this.isSyncing = false;
		}
	}

	// Apply changes from server to local database
	private async applyServerChanges(data: PullResponse) {
		// Bands
		for (const band of data.bands) {
			const existing = await db.select().from(s.bands).where(sql`${s.bands.id} = ${band.id}`);
			if (existing.length === 0 || new Date(band.updatedAt) > existing[0].updatedAt) {
				await db.insert(s.bands)
					.values({
						id: band.id,
						name: band.name,
						resistance: band.resistance,
						color: band.color,
						createdAt: new Date(band.createdAt),
						updatedAt: new Date(band.updatedAt),
						deletedAt: band.deletedAt ? new Date(band.deletedAt) : null,
						syncedAt: new Date()
					})
					.onConflictDoUpdate({
						target: s.bands.id,
						set: {
							name: band.name,
							resistance: band.resistance,
							color: band.color,
							updatedAt: new Date(band.updatedAt),
							deletedAt: band.deletedAt ? new Date(band.deletedAt) : null,
							syncedAt: new Date()
						}
					});
			}
		}

		// Settings
		for (const setting of data.settings) {
			const existing = await db.select().from(s.settings).where(sql`${s.settings.id} = ${setting.id}`);
			if (existing.length === 0 || new Date(setting.updatedAt) > existing[0].updatedAt) {
				await db.insert(s.settings)
					.values({
						id: setting.id,
						weightUnit: setting.weightUnit,
						keepScreenAwake: setting.keepScreenAwake,
						updatedAt: new Date(setting.updatedAt),
						syncedAt: new Date()
					})
					.onConflictDoUpdate({
						target: s.settings.id,
						set: {
							weightUnit: setting.weightUnit,
							keepScreenAwake: setting.keepScreenAwake,
							updatedAt: new Date(setting.updatedAt),
							syncedAt: new Date()
						}
					});
			}
		}

		// Exercises
		for (const exercise of data.exercises) {
			const existing = await db.select().from(s.exercises).where(sql`${s.exercises.id} = ${exercise.id}`);
			if (existing.length === 0 || new Date(exercise.updatedAt) > existing[0].updatedAt) {
				await db.insert(s.exercises)
					.values({
						id: exercise.id,
						name: exercise.name,
						createdAt: new Date(exercise.createdAt),
						updatedAt: new Date(exercise.updatedAt),
						deletedAt: exercise.deletedAt ? new Date(exercise.deletedAt) : null,
						syncedAt: new Date()
					})
					.onConflictDoUpdate({
						target: s.exercises.id,
						set: {
							name: exercise.name,
							updatedAt: new Date(exercise.updatedAt),
							deletedAt: exercise.deletedAt ? new Date(exercise.deletedAt) : null,
							syncedAt: new Date()
						}
					});
			}
		}

		// Workout Templates
		for (const template of data.workoutTemplates) {
			const existing = await db.select().from(s.workoutTemplates).where(sql`${s.workoutTemplates.id} = ${template.id}`);
			if (existing.length === 0 || new Date(template.updatedAt) > existing[0].updatedAt) {
				await db.insert(s.workoutTemplates)
					.values({
						id: template.id,
						name: template.name,
						createdAt: new Date(template.createdAt),
						updatedAt: new Date(template.updatedAt),
						icon: template.icon,
						sortOrder: template.sortOrder,
						syncedAt: new Date()
					})
					.onConflictDoUpdate({
						target: s.workoutTemplates.id,
						set: {
							name: template.name,
							updatedAt: new Date(template.updatedAt),
							icon: template.icon,
							sortOrder: template.sortOrder,
							syncedAt: new Date()
						}
					});
			}
		}

		// Workout Template Exercises (junction table - simpler upsert)
		for (const wte of data.workoutTemplateExercises) {
			await db.insert(s.workoutTemplateExercises)
				.values({
					id: wte.id,
					templateId: wte.templateId,
					exerciseId: wte.exerciseId,
					sortOrder: wte.sortOrder,
					syncedAt: new Date()
				})
				.onConflictDoUpdate({
					target: s.workoutTemplateExercises.id,
					set: {
						templateId: wte.templateId,
						exerciseId: wte.exerciseId,
						sortOrder: wte.sortOrder,
						syncedAt: new Date()
					}
				});
		}

		// Workout Sessions
		for (const session of data.workoutSessions) {
			const existing = await db.select().from(s.workoutSessions).where(sql`${s.workoutSessions.id} = ${session.id}`);
			if (existing.length === 0 || new Date(session.updatedAt) > existing[0].updatedAt) {
				await db.insert(s.workoutSessions)
					.values({
						id: session.id,
						templateId: session.templateId,
						startedAt: new Date(session.startedAt),
						updatedAt: new Date(session.updatedAt),
						endedAt: session.endedAt ? new Date(session.endedAt) : null,
						notes: session.notes,
						plannedExercises: session.plannedExercises,
						syncedAt: new Date()
					})
					.onConflictDoUpdate({
						target: s.workoutSessions.id,
						set: {
							templateId: session.templateId,
							updatedAt: new Date(session.updatedAt),
							endedAt: session.endedAt ? new Date(session.endedAt) : null,
							notes: session.notes,
							plannedExercises: session.plannedExercises,
							syncedAt: new Date()
						}
					});
			}
		}

		// Logged Exercises
		for (const log of data.loggedExercises) {
			await db.insert(s.loggedExercises)
				.values({
					id: log.id,
					sessionId: log.sessionId,
					exerciseId: log.exerciseId,
					fullReps: log.fullReps,
					partialReps: log.partialReps,
					notes: log.notes,
					loggedAt: new Date(log.loggedAt),
					syncedAt: new Date()
				})
				.onConflictDoUpdate({
					target: s.loggedExercises.id,
					set: {
						sessionId: log.sessionId,
						exerciseId: log.exerciseId,
						fullReps: log.fullReps,
						partialReps: log.partialReps,
						notes: log.notes,
						loggedAt: new Date(log.loggedAt),
						syncedAt: new Date()
					}
				});
		}

		// Logged Exercise Bands
		for (const leb of data.loggedExerciseBands) {
			await db.insert(s.loggedExerciseBands)
				.values({
					id: leb.id,
					loggedExerciseId: leb.loggedExerciseId,
					bandId: leb.bandId,
					syncedAt: new Date()
				})
				.onConflictDoUpdate({
					target: s.loggedExerciseBands.id,
					set: {
						loggedExerciseId: leb.loggedExerciseId,
						bandId: leb.bandId,
						syncedAt: new Date()
					}
				});
		}
	}

	// Force a manual sync
	async manualSync() {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		await this.fullSync();
	}
}

// Create and export singleton instance
export const syncService = new SyncService();


// Types for sync API responses
interface PushResponse {
	syncedAt: string;
}

interface PullResponse {
	bands: Array<{
		id: string;
		name: string;
		resistance: number;
		color: string;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	}>;
	settings: Array<{
		id: string;
		weightUnit: string;
		keepScreenAwake: boolean;
		updatedAt: string;
	}>;
	exercises: Array<{
		id: string;
		name: string;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	}>;
	workoutTemplates: Array<{
		id: string;
		name: string;
		icon: string | null;
		sortOrder: number;
		createdAt: string;
		updatedAt: string;
	}>;
	workoutTemplateExercises: Array<{
		id: string;
		templateId: string;
		exerciseId: string;
		sortOrder: number;
	}>;
	workoutSessions: Array<{
		id: string;
		templateId: string | null;
		startedAt: string;
		updatedAt: string;
		endedAt: string | null;
		notes: string | null;
		plannedExercises: string[] | null;
	}>;
	loggedExercises: Array<{
		id: string;
		sessionId: string;
		exerciseId: string;
		fullReps: number;
		partialReps: number;
		notes: string | null;
		loggedAt: string;
	}>;
	loggedExerciseBands: Array<{
		id: string;
		loggedExerciseId: string;
		bandId: string;
	}>;
	syncedAt: string;
}