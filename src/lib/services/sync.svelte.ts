import { browser } from '$app/environment';
import { db } from '$lib/db/app/client';
import * as s from '$lib/db/app/schema';
import { sessionStore } from '$lib/auth-client';
import { type Column, and, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { getCatalogNameKey } from '$lib/db/catalog';
import {
	dedupeTemplateExercisePairs,
	remapLocalBandId,
	remapLocalExerciseId,
	remapLocalTemplateId
} from '$lib/db/app/catalogMerge';
import {
	chunkArray,
	getOrphanSyncedJunctionIds,
	getSafeReplacementTemplateIds,
	hasPushWork,
	idsOf,
	resolveSyncedMarkTargets,
	rowsNeedingWrite,
	syncRetryDelayMs
} from './syncHelpers';

const UPSERT_CHUNK_SIZE = 100;

const isUnsyncedWhere = (table: { syncedAt: Column; updatedAt: Column }) =>
	or(isNull(table.syncedAt), lt(table.syncedAt, table.updatedAt));

class SyncService {
	// Reactive state
	isOnline = $state(browser ? navigator.onLine : true);
	isSyncing = $state(false);
	lastSyncAt = $state<string | null>(null);
	syncError = $state<string | null>(null);
	private activeUserId: string | null = null;

	// Debounce / retry / queue
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private syncQueued = false;
	private retryAttempt = 0;
	private readonly DEBOUNCE_MS = 500;
	private readonly RETRY_MS = 2000;
	private readonly RETRY_MAX_MS = 60_000;

	// Track if we're initialized
	private initialized = false;

	/** Template IDs whose exercise lists were explicitly replaced and need server-side replace-on-push. */
	private templateExerciseReplacementIds = new Set<string>();

	private onSyncComplete: (() => void | Promise<void>) | null = null;

	constructor() {
		// Guest mode uses no server sync marker.
		this.lastSyncAt = null;
	}

	setOnSyncComplete(callback: () => void | Promise<void>) {
		this.onSyncComplete = callback;
	}

	markTemplateExercisesReplaced(templateId: string) {
		this.templateExerciseReplacementIds.add(templateId);
	}

	private getLastSyncKey(userId: string) {
		return `lastSyncAt:${userId}`;
	}

	private getMigrationMarkerKey(userId: string) {
		return `seedSlugMigrationDone:${userId}`;
	}

	private loadUserSyncState(userId: string) {
		if (!browser) return;
		this.activeUserId = userId;
		this.lastSyncAt = localStorage.getItem(this.getLastSyncKey(userId));
	}

	private isLoggedIn() {
		return !!sessionStore.value?.data?.user;
	}

	private clearDebounce() {
		if (!this.debounceTimer) return;
		clearTimeout(this.debounceTimer);
		this.debounceTimer = null;
	}

	private clearRetry() {
		if (!this.retryTimer) return;
		clearTimeout(this.retryTimer);
		this.retryTimer = null;
	}

	/** Cancel debounce and sync immediately (background/close/online). */
	private flushSync() {
		if (!browser || !this.isOnline || !this.isLoggedIn()) return;
		this.clearDebounce();
		void this.fullSync();
	}

	private scheduleRetry() {
		if (this.retryTimer || !browser || !this.isOnline) return;
		const delay = syncRetryDelayMs(this.retryAttempt, this.RETRY_MS, this.RETRY_MAX_MS);
		this.retryAttempt += 1;
		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			void this.fullSync();
		}, delay);
	}

	// Initialize sync service - call after db is ready
	initialize() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		window.addEventListener('online', () => {
			this.isOnline = true;
			this.flushSync();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				this.flushSync();
			}
		});

		window.addEventListener('pagehide', () => {
			this.flushSync();
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
					if (this.activeUserId !== currentUserId) {
						this.loadUserSyncState(currentUserId);
					}

					// Sync on: initial page load with logged-in user, or user just logged in
					if (isInitialLoad || previousUserId !== currentUserId) {
						this.fullSync();
					}
				}

				if (!currentUserId) {
					this.activeUserId = null;
					this.lastSyncAt = null;
					this.clearDebounce();
					this.clearRetry();
					this.syncQueued = false;
					this.retryAttempt = 0;
				}

				previousUserId = currentUserId;
				isInitialLoad = false;
			});
		});
	}

	// Trigger a debounced sync after write operations
	triggerSync() {
		if (!browser || !this.isOnline) return;
		if (!this.isLoggedIn()) return;

		this.clearDebounce();
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.fullSync();
		}, this.DEBOUNCE_MS);
	}

	// Full bidirectional sync
	async fullSync() {
		if (!browser || !db) return;

		if (this.isSyncing) {
			this.syncQueued = true;
			return;
		}

		const session = sessionStore.value;
		if (!session?.data?.user) return;
		const userId = session.data.user.id;

		if (this.activeUserId !== userId) {
			this.loadUserSyncState(userId);
		}

		this.isSyncing = true;
		this.syncError = null;
		this.clearRetry();

		try {
			await this.runSeedSlugMigrationForUser(userId);

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
				db.select().from(s.bands).where(isUnsyncedWhere(s.bands)),
				db.select().from(s.settings).where(isUnsyncedWhere(s.settings)),
				db.select().from(s.exercises).where(isUnsyncedWhere(s.exercises)),
				db.select().from(s.workoutTemplates).where(isUnsyncedWhere(s.workoutTemplates)),
				db
					.select()
					.from(s.workoutTemplateExercises)
					.where(isNull(s.workoutTemplateExercises.syncedAt)),
				db.select().from(s.workoutSessions).where(isUnsyncedWhere(s.workoutSessions)),
				db.select().from(s.loggedExercises).where(isNull(s.loggedExercises.syncedAt)),
				db.select().from(s.loggedExerciseBands).where(isNull(s.loggedExerciseBands.syncedAt))
			]);

			let replacementTemplateIds: string[] = [];
			let workoutTemplateExercisesToPush = unsyncedTemplateExercises;

			if (this.templateExerciseReplacementIds.size > 0) {
				const allLocalTemplateExercises = await db.select().from(s.workoutTemplateExercises);
				const localExerciseCountsByTemplateId = new Map<string, number>();
				for (const wte of allLocalTemplateExercises) {
					localExerciseCountsByTemplateId.set(
						wte.templateId,
						(localExerciseCountsByTemplateId.get(wte.templateId) ?? 0) + 1
					);
				}

				replacementTemplateIds = getSafeReplacementTemplateIds({
					markedTemplateIds: this.templateExerciseReplacementIds,
					localExerciseCountsByTemplateId,
					// Marked IDs are intentional edits (including clear-all). Empty skip only
					// mattered when metadata-dirty templates auto-replaced.
					allowEmptyReplace: true
				});
				const replacementTemplateIdSet = new Set(replacementTemplateIds);
				const replacementTemplateExercises =
					replacementTemplateIds.length > 0
						? allLocalTemplateExercises.filter((wte) =>
								replacementTemplateIdSet.has(wte.templateId)
							)
						: [];
				workoutTemplateExercisesToPush = [
					...replacementTemplateExercises,
					...unsyncedTemplateExercises.filter((wte) => !replacementTemplateIdSet.has(wte.templateId))
				];
			}

			const hasChangesToPush = hasPushWork({
				rowCounts: [
					unsyncedBands.length,
					unsyncedSettings.length,
					unsyncedExercises.length,
					unsyncedTemplates.length,
					workoutTemplateExercisesToPush.length,
					unsyncedSessions.length,
					unsyncedLoggedExercises.length,
					unsyncedLoggedExerciseBands.length
				],
				replacementTemplateIds
			});

			if (hasChangesToPush) {
				const pushResponse = await fetch('/api/sync/push', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						bands: unsyncedBands.map((b) => ({
							...b,
							createdAt: b.createdAt.toISOString(),
							updatedAt: b.updatedAt.toISOString(),
							deletedAt: b.deletedAt?.toISOString() ?? null
						})),
						settings: unsyncedSettings.map((row) => ({
							...row,
							updatedAt: row.updatedAt.toISOString()
						})),
						exercises: unsyncedExercises.map((e) => ({
							...e,
							createdAt: e.createdAt.toISOString(),
							updatedAt: e.updatedAt.toISOString(),
							deletedAt: e.deletedAt?.toISOString() ?? null
						})),
						workoutTemplates: unsyncedTemplates.map((t) => ({
							...t,
							createdAt: t.createdAt.toISOString(),
							updatedAt: t.updatedAt.toISOString(),
							deletedAt: t.deletedAt?.toISOString() ?? null
						})),
						replaceWorkoutTemplateExercisesForTemplateIds: replacementTemplateIds,
						workoutTemplateExercises: workoutTemplateExercisesToPush,
						workoutSessions: unsyncedSessions.map((row) => ({
							...row,
							startedAt: row.startedAt.toISOString(),
							updatedAt: row.updatedAt.toISOString(),
							endedAt: row.endedAt?.toISOString() ?? null
						})),
						loggedExercises: unsyncedLoggedExercises.map((le) => ({
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
				await this.applyPushRemaps(pushResult.idRemaps);

				for (const templateId of replacementTemplateIds) {
					this.templateExerciseReplacementIds.delete(templateId);
					const remapped = pushResult.idRemaps?.workoutTemplates[templateId];
					if (remapped) this.templateExerciseReplacementIds.delete(remapped);
				}

				// Mark only rows that were included in this push (after remaps).
				// For updatedAt-tracked tables, require snapshot updatedAt so a
				// concurrent local edit during the push stays dirty.
				const now = new Date();
				const bandTargets = resolveSyncedMarkTargets(
					unsyncedBands,
					pushResult.idRemaps?.bands
				);
				const exerciseTargets = resolveSyncedMarkTargets(
					unsyncedExercises,
					pushResult.idRemaps?.exercises
				);
				const templateTargets = resolveSyncedMarkTargets(
					unsyncedTemplates,
					pushResult.idRemaps?.workoutTemplates
				);
				const settingTargets = resolveSyncedMarkTargets(unsyncedSettings);
				const sessionTargets = resolveSyncedMarkTargets(unsyncedSessions);
				const wteIds = idsOf(workoutTemplateExercisesToPush);
				const loggedExerciseIds = idsOf(unsyncedLoggedExercises);
				const loggedExerciseBandIds = idsOf(unsyncedLoggedExerciseBands);

				await Promise.all([
					...bandTargets.map((target) =>
						db
							.update(s.bands)
							.set({ syncedAt: target.updatedAt ?? now })
							.where(
								target.updatedAt
									? and(eq(s.bands.id, target.id), eq(s.bands.updatedAt, target.updatedAt))
									: eq(s.bands.id, target.id)
							)
					),
					...settingTargets.map((target) =>
						db
							.update(s.settings)
							.set({ syncedAt: target.updatedAt ?? now })
							.where(
								target.updatedAt
									? and(
											eq(s.settings.id, target.id),
											eq(s.settings.updatedAt, target.updatedAt)
										)
									: eq(s.settings.id, target.id)
							)
					),
					...exerciseTargets.map((target) =>
						db
							.update(s.exercises)
							.set({ syncedAt: target.updatedAt ?? now })
							.where(
								target.updatedAt
									? and(
											eq(s.exercises.id, target.id),
											eq(s.exercises.updatedAt, target.updatedAt)
										)
									: eq(s.exercises.id, target.id)
							)
					),
					...templateTargets.map((target) =>
						db
							.update(s.workoutTemplates)
							.set({ syncedAt: target.updatedAt ?? now })
							.where(
								target.updatedAt
									? and(
											eq(s.workoutTemplates.id, target.id),
											eq(s.workoutTemplates.updatedAt, target.updatedAt)
										)
									: eq(s.workoutTemplates.id, target.id)
							)
					),
					wteIds.length > 0 &&
						db
							.update(s.workoutTemplateExercises)
							.set({ syncedAt: now })
							.where(inArray(s.workoutTemplateExercises.id, wteIds)),
					...sessionTargets.map((target) =>
						db
							.update(s.workoutSessions)
							.set({ syncedAt: target.updatedAt ?? now })
							.where(
								target.updatedAt
									? and(
											eq(s.workoutSessions.id, target.id),
											eq(s.workoutSessions.updatedAt, target.updatedAt)
										)
									: eq(s.workoutSessions.id, target.id)
							)
					),
					loggedExerciseIds.length > 0 &&
						db
							.update(s.loggedExercises)
							.set({ syncedAt: now })
							.where(inArray(s.loggedExercises.id, loggedExerciseIds)),
					loggedExerciseBandIds.length > 0 &&
						db
							.update(s.loggedExerciseBands)
							.set({ syncedAt: now })
							.where(inArray(s.loggedExerciseBands.id, loggedExerciseBandIds))
				]);
			}

			// Pull server changes
			const pullUrl = new URL('/api/sync/pull', window.location.origin);
			if (this.lastSyncAt) {
				pullUrl.searchParams.set('lastSyncAt', this.lastSyncAt);
			}
			const pullResponse = await fetch(pullUrl);

			if (!pullResponse.ok) {
				throw new Error(`Pull failed: ${pullResponse.status}`);
			}

			const pullResult: PullResponse = await pullResponse.json();

			await this.applyServerChanges(pullResult);

			this.lastSyncAt = pullResult.syncedAt;
			localStorage.setItem(this.getLastSyncKey(userId), pullResult.syncedAt);
			this.retryAttempt = 0;

			await this.onSyncComplete?.();
		} catch (err) {
			console.error('Sync failed:', err);
			this.syncError = err instanceof Error ? err.message : 'Sync failed';
			this.scheduleRetry();
		} finally {
			this.isSyncing = false;
			if (this.syncQueued) {
				this.syncQueued = false;
				void this.fullSync();
			}
		}
	}

	private async runSeedSlugMigrationForUser(userId: string) {
		if (!browser) return;

		const markerKey = this.getMigrationMarkerKey(userId);
		if (localStorage.getItem(markerKey) === '1') return;

		await this.dedupeLocalSeedRows();

		// Drop legacy global sync marker after user-scoped migration.
		localStorage.removeItem('lastSyncAt');
		localStorage.setItem(markerKey, '1');
	}

	private sortSeededRowsByCanonicalPriority<T extends { updatedAt: Date; deletedAt?: Date | null }>(
		rows: T[]
	) {
		return [...rows].sort((a, b) => {
			const aDeletedAt = a.deletedAt ?? null;
			const bDeletedAt = b.deletedAt ?? null;
			if (!!aDeletedAt !== !!bDeletedAt) {
				return aDeletedAt ? 1 : -1;
			}
			return b.updatedAt.getTime() - a.updatedAt.getTime();
		});
	}

	private async dedupeLocalSeedRows() {
		// Bands: remap logged exercise band links before removing duplicates.
		const seededBands = await db.select().from(s.bands).where(isNotNull(s.bands.seedSlug));
		const bandsBySlug: Record<string, typeof seededBands> = {};
		for (const band of seededBands) {
			const slug = band.seedSlug;
			if (!slug) continue;
			const rows = bandsBySlug[slug] ?? [];
			rows.push(band);
			bandsBySlug[slug] = rows;
		}
		for (const rows of Object.values(bandsBySlug)) {
			if (rows.length < 2) continue;
			const [canonical, ...duplicates] = this.sortSeededRowsByCanonicalPriority(rows);
			for (const duplicate of duplicates) {
				await this.remapBandId(duplicate.id, canonical.id);
				await db.delete(s.bands).where(eq(s.bands.id, duplicate.id));
			}
		}

		// Exercises: remap template + log references before removing duplicates.
		const seededExercises = await db
			.select()
			.from(s.exercises)
			.where(isNotNull(s.exercises.seedSlug));
		const exercisesBySlug: Record<string, typeof seededExercises> = {};
		for (const exercise of seededExercises) {
			const slug = exercise.seedSlug;
			if (!slug) continue;
			const rows = exercisesBySlug[slug] ?? [];
			rows.push(exercise);
			exercisesBySlug[slug] = rows;
		}
		for (const rows of Object.values(exercisesBySlug)) {
			if (rows.length < 2) continue;
			const [canonical, ...duplicates] = this.sortSeededRowsByCanonicalPriority(rows);
			for (const duplicate of duplicates) {
				await this.remapExerciseId(duplicate.id, canonical.id);
				await db.delete(s.exercises).where(eq(s.exercises.id, duplicate.id));
			}
		}

		// Templates: remap junction + sessions before removing duplicates.
		const seededTemplates = await db
			.select()
			.from(s.workoutTemplates)
			.where(isNotNull(s.workoutTemplates.seedSlug));
		const templatesBySlug: Record<string, typeof seededTemplates> = {};
		for (const template of seededTemplates) {
			const slug = template.seedSlug;
			if (!slug) continue;
			const rows = templatesBySlug[slug] ?? [];
			rows.push(template);
			templatesBySlug[slug] = rows;
		}
		for (const rows of Object.values(templatesBySlug)) {
			if (rows.length < 2) continue;
			const [canonical, ...duplicates] = this.sortSeededRowsByCanonicalPriority(rows);
			for (const duplicate of duplicates) {
				await this.remapTemplateId(duplicate.id, canonical.id);
				await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, duplicate.id));
			}
		}

		// Template exercise links: keep one row per seeded slug.
		const seededTemplateExercises = await db
			.select()
			.from(s.workoutTemplateExercises)
			.where(isNotNull(s.workoutTemplateExercises.seedSlug));
		const templateExercisesBySlug: Record<string, typeof seededTemplateExercises> = {};
		for (const templateExercise of seededTemplateExercises) {
			const slug = templateExercise.seedSlug;
			if (!slug) continue;
			const rows = templateExercisesBySlug[slug] ?? [];
			rows.push(templateExercise);
			templateExercisesBySlug[slug] = rows;
		}
		for (const rows of Object.values(templateExercisesBySlug)) {
			if (rows.length < 2) continue;
			const [canonical, ...duplicates] = rows.sort((a, b) => a.sortOrder - b.sortOrder);
			for (const duplicate of duplicates) {
				if (duplicate.id === canonical.id) continue;
				await db
					.delete(s.workoutTemplateExercises)
					.where(eq(s.workoutTemplateExercises.id, duplicate.id));
			}
		}
	}

	private async remapBandId(oldId: string, newId: string) {
		await remapLocalBandId(db, oldId, newId);
	}

	private async remapExerciseId(oldId: string, newId: string) {
		await remapLocalExerciseId(db, oldId, newId);
	}

	private async remapTemplateId(oldId: string, newId: string) {
		await remapLocalTemplateId(db, oldId, newId);
	}

	private async applyPushRemaps(idRemaps?: SyncIdRemaps) {
		if (!idRemaps) return;

		for (const [oldId, newId] of Object.entries(idRemaps.bands)) {
			await this.applyCatalogRemap(oldId, newId, s.bands, (from, to) => this.remapBandId(from, to));
		}

		for (const [oldId, newId] of Object.entries(idRemaps.exercises)) {
			await this.applyCatalogRemap(oldId, newId, s.exercises, (from, to) =>
				this.remapExerciseId(from, to)
			);
		}

		for (const [oldId, newId] of Object.entries(idRemaps.workoutTemplates)) {
			await this.applyCatalogRemap(oldId, newId, s.workoutTemplates, (from, to) =>
				this.remapTemplateId(from, to)
			);
		}
	}

	private async applyCatalogRemap(
		oldId: string,
		newId: string,
		table: typeof s.bands | typeof s.exercises | typeof s.workoutTemplates,
		remapReferences: (oldId: string, newId: string) => Promise<void>
	) {
		if (oldId === newId) return;

		const canonical = await db.select({ id: table.id }).from(table).where(eq(table.id, newId));
		if (canonical.length === 0) return;

		await remapReferences(oldId, newId);
		await db.delete(table).where(eq(table.id, oldId));
	}

	// Apply changes from server to local database
	private async applyServerChanges(data: PullResponse) {
		const syncedAt = new Date();
		const needsCatalog =
			data.bands.length > 0 || data.exercises.length > 0 || data.workoutTemplates.length > 0;
		const needsWte = data.workoutTemplateExercises.length > 0;
		const needsSessions = data.workoutSessions.length > 0;
		const needsLogs = data.loggedExercises.length > 0;
		const needsLebs = data.loggedExerciseBands.length > 0;

		const [localBands, localExercises, localTemplates, localWtes, localSessions, localLogs, localLebs] =
			await Promise.all([
				needsCatalog ? db.select().from(s.bands) : Promise.resolve([]),
				needsCatalog ? db.select().from(s.exercises) : Promise.resolve([]),
				needsCatalog ? db.select().from(s.workoutTemplates) : Promise.resolve([]),
				needsWte ? db.select().from(s.workoutTemplateExercises) : Promise.resolve([]),
				needsSessions ? db.select().from(s.workoutSessions) : Promise.resolve([]),
				needsLogs ? db.select().from(s.loggedExercises) : Promise.resolve([]),
				needsLebs ? db.select().from(s.loggedExerciseBands) : Promise.resolve([])
			]);

		const bandsById = new Map(localBands.map((row) => [row.id, row]));
		const bandsBySlug = new Map(
			localBands.filter((row) => row.seedSlug).map((row) => [row.seedSlug!, row])
		);
		const bandsByNameKey = new Map(
			localBands.filter((row) => row.nameKey).map((row) => [row.nameKey!, row])
		);

		for (const band of data.bands) {
			let conflictingLocalId: string | null = null;
			const nameKey = band.nameKey ?? getCatalogNameKey(band.name);
			if (band.seedSlug) {
				const localBySlug = bandsBySlug.get(band.seedSlug);
				if (localBySlug && localBySlug.id !== band.id) {
					conflictingLocalId = localBySlug.id;
					await db.update(s.bands).set({ seedSlug: null }).where(eq(s.bands.id, localBySlug.id));
					bandsBySlug.delete(band.seedSlug);
				}
			}
			const localByName = bandsByNameKey.get(nameKey);
			if (localByName && localByName.id !== band.id) {
				conflictingLocalId = localByName.id;
				await db.update(s.bands).set({ nameKey: null }).where(eq(s.bands.id, localByName.id));
				bandsByNameKey.delete(nameKey);
			}

			const existing = bandsById.get(band.id);
			if (!existing || new Date(band.updatedAt) > existing.updatedAt) {
				const row = {
					id: band.id,
					name: band.name,
					nameKey,
					resistance: band.resistance,
					color: band.color,
					seedSlug: band.seedSlug,
					createdAt: new Date(band.createdAt),
					updatedAt: new Date(band.updatedAt),
					deletedAt: band.deletedAt ? new Date(band.deletedAt) : null,
					syncedAt
				};
				await db
					.insert(s.bands)
					.values(row)
					.onConflictDoUpdate({
						target: s.bands.id,
						set: {
							name: row.name,
							nameKey: row.nameKey,
							resistance: row.resistance,
							color: row.color,
							seedSlug: row.seedSlug,
							updatedAt: row.updatedAt,
							deletedAt: row.deletedAt,
							syncedAt
						}
					});
				bandsById.set(band.id, {
					id: row.id,
					name: row.name,
					nameKey: row.nameKey,
					resistance: row.resistance,
					color: row.color,
					seedSlug: row.seedSlug,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					deletedAt: row.deletedAt,
					syncedAt: row.syncedAt
				});
				if (row.seedSlug) bandsBySlug.set(row.seedSlug, bandsById.get(band.id)!);
				bandsByNameKey.set(nameKey, bandsById.get(band.id)!);
			}

			if (conflictingLocalId) {
				await this.remapBandId(conflictingLocalId, band.id);
				await db.delete(s.bands).where(eq(s.bands.id, conflictingLocalId));
				bandsById.delete(conflictingLocalId);
			}
		}

		for (const setting of data.settings) {
			const existing = await db.select().from(s.settings).where(eq(s.settings.id, setting.id));
			if (existing.length === 0 || new Date(setting.updatedAt) > existing[0].updatedAt) {
				await db
					.insert(s.settings)
					.values({
						id: setting.id,
						weightUnit: setting.weightUnit,
						keepScreenAwake: setting.keepScreenAwake,
						updatedAt: new Date(setting.updatedAt),
						syncedAt
					})
					.onConflictDoUpdate({
						target: s.settings.id,
						set: {
							weightUnit: setting.weightUnit,
							keepScreenAwake: setting.keepScreenAwake,
							updatedAt: new Date(setting.updatedAt),
							syncedAt
						}
					});
			}
		}

		const exercisesById = new Map(localExercises.map((row) => [row.id, row]));
		const exercisesBySlug = new Map(
			localExercises.filter((row) => row.seedSlug).map((row) => [row.seedSlug!, row])
		);
		const exercisesByNameKey = new Map(
			localExercises.filter((row) => row.nameKey).map((row) => [row.nameKey!, row])
		);

		for (const exercise of data.exercises) {
			let conflictingLocalId: string | null = null;
			const nameKey = exercise.nameKey ?? getCatalogNameKey(exercise.name);
			if (exercise.seedSlug) {
				const localBySlug = exercisesBySlug.get(exercise.seedSlug);
				if (localBySlug && localBySlug.id !== exercise.id) {
					conflictingLocalId = localBySlug.id;
					await db
						.update(s.exercises)
						.set({ seedSlug: null })
						.where(eq(s.exercises.id, localBySlug.id));
					exercisesBySlug.delete(exercise.seedSlug);
				}
			}
			const localByName = exercisesByNameKey.get(nameKey);
			if (localByName && localByName.id !== exercise.id) {
				conflictingLocalId = localByName.id;
				await db
					.update(s.exercises)
					.set({ nameKey: null })
					.where(eq(s.exercises.id, localByName.id));
				exercisesByNameKey.delete(nameKey);
			}

			const existing = exercisesById.get(exercise.id);
			if (!existing || new Date(exercise.updatedAt) > existing.updatedAt) {
				const row = {
					id: exercise.id,
					name: exercise.name,
					nameKey,
					seedSlug: exercise.seedSlug,
					createdAt: new Date(exercise.createdAt),
					updatedAt: new Date(exercise.updatedAt),
					deletedAt: exercise.deletedAt ? new Date(exercise.deletedAt) : null,
					syncedAt
				};
				await db
					.insert(s.exercises)
					.values(row)
					.onConflictDoUpdate({
						target: s.exercises.id,
						set: {
							name: row.name,
							nameKey: row.nameKey,
							seedSlug: row.seedSlug,
							updatedAt: row.updatedAt,
							deletedAt: row.deletedAt,
							syncedAt
						}
					});
				exercisesById.set(exercise.id, {
					id: row.id,
					name: row.name,
					nameKey: row.nameKey,
					seedSlug: row.seedSlug,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					deletedAt: row.deletedAt,
					syncedAt: row.syncedAt
				});
				if (row.seedSlug) exercisesBySlug.set(row.seedSlug, exercisesById.get(exercise.id)!);
				exercisesByNameKey.set(nameKey, exercisesById.get(exercise.id)!);
			}

			if (conflictingLocalId) {
				await this.remapExerciseId(conflictingLocalId, exercise.id);
				await db.delete(s.exercises).where(eq(s.exercises.id, conflictingLocalId));
				exercisesById.delete(conflictingLocalId);
			}
		}

		const templatesById = new Map(localTemplates.map((row) => [row.id, row]));
		const templatesBySlug = new Map(
			localTemplates.filter((row) => row.seedSlug).map((row) => [row.seedSlug!, row])
		);
		const templatesByNameKey = new Map(
			localTemplates.filter((row) => row.nameKey).map((row) => [row.nameKey!, row])
		);

		for (const template of data.workoutTemplates) {
			let conflictingLocalId: string | null = null;
			const nameKey = template.nameKey ?? getCatalogNameKey(template.name);
			if (template.seedSlug) {
				const localBySlug = templatesBySlug.get(template.seedSlug);
				if (localBySlug && localBySlug.id !== template.id) {
					conflictingLocalId = localBySlug.id;
					await db
						.update(s.workoutTemplates)
						.set({ seedSlug: null })
						.where(eq(s.workoutTemplates.id, localBySlug.id));
					templatesBySlug.delete(template.seedSlug);
				}
			}
			const localByName = templatesByNameKey.get(nameKey);
			if (localByName && localByName.id !== template.id) {
				conflictingLocalId = localByName.id;
				await db
					.update(s.workoutTemplates)
					.set({ nameKey: null })
					.where(eq(s.workoutTemplates.id, localByName.id));
				templatesByNameKey.delete(nameKey);
			}

			const existing = templatesById.get(template.id);
			if (!existing || new Date(template.updatedAt) > existing.updatedAt) {
				const row = {
					id: template.id,
					name: template.name,
					nameKey,
					seedSlug: template.seedSlug,
					createdAt: new Date(template.createdAt),
					updatedAt: new Date(template.updatedAt),
					deletedAt: template.deletedAt ? new Date(template.deletedAt) : null,
					icon: template.icon,
					sortOrder: template.sortOrder,
					syncedAt
				};
				await db
					.insert(s.workoutTemplates)
					.values(row)
					.onConflictDoUpdate({
						target: s.workoutTemplates.id,
						set: {
							name: row.name,
							nameKey: row.nameKey,
							seedSlug: row.seedSlug,
							updatedAt: row.updatedAt,
							deletedAt: row.deletedAt,
							icon: row.icon,
							sortOrder: row.sortOrder,
							syncedAt
						}
					});
				templatesById.set(template.id, {
					id: row.id,
					name: row.name,
					nameKey: row.nameKey,
					seedSlug: row.seedSlug,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					deletedAt: row.deletedAt,
					icon: row.icon,
					sortOrder: row.sortOrder,
					syncedAt: row.syncedAt
				});
				if (row.seedSlug) templatesBySlug.set(row.seedSlug, templatesById.get(template.id)!);
				templatesByNameKey.set(nameKey, templatesById.get(template.id)!);
			}

			if (conflictingLocalId) {
				await this.remapTemplateId(conflictingLocalId, template.id);
				await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, conflictingLocalId));
				templatesById.delete(conflictingLocalId);
			}
		}

		const wtesById = new Map(localWtes.map((row) => [row.id, row]));
		const wtesBySlug = new Map(
			localWtes.filter((row) => row.seedSlug).map((row) => [row.seedSlug!, row])
		);
		let wteWrote = false;

		for (const wte of data.workoutTemplateExercises) {
			let conflictingLocalId: string | null = null;
			if (wte.seedSlug) {
				const localBySlug = wtesBySlug.get(wte.seedSlug);
				if (localBySlug && localBySlug.id !== wte.id) {
					conflictingLocalId = localBySlug.id;
					await db
						.update(s.workoutTemplateExercises)
						.set({ seedSlug: null })
						.where(eq(s.workoutTemplateExercises.id, localBySlug.id));
					wtesBySlug.delete(wte.seedSlug);
				}
			}

			const existing = wtesById.get(wte.id);
			const unchanged =
				existing &&
				existing.syncedAt != null &&
				existing.templateId === wte.templateId &&
				existing.exerciseId === wte.exerciseId &&
				existing.seedSlug === wte.seedSlug &&
				existing.sortOrder === wte.sortOrder;

			if (!unchanged) {
				wteWrote = true;
				await db
					.insert(s.workoutTemplateExercises)
					.values({
						id: wte.id,
						templateId: wte.templateId,
						exerciseId: wte.exerciseId,
						seedSlug: wte.seedSlug,
						sortOrder: wte.sortOrder,
						syncedAt
					})
					.onConflictDoUpdate({
						target: s.workoutTemplateExercises.id,
						set: {
							templateId: wte.templateId,
							exerciseId: wte.exerciseId,
							seedSlug: wte.seedSlug,
							sortOrder: wte.sortOrder,
							syncedAt
						}
					});
			}

			if (conflictingLocalId) {
				wteWrote = true;
				await db
					.delete(s.workoutTemplateExercises)
					.where(eq(s.workoutTemplateExercises.id, conflictingLocalId));
				wtesById.delete(conflictingLocalId);
			}
		}

		// Drop synced local junctions missing from the full server pull.
		const pulledWteIds = data.workoutTemplateExercises.map((wte) => wte.id);
		const localSyncedWteIds = (
			needsWte
				? localWtes.filter((row) => row.syncedAt != null)
				: await db
						.select({ id: s.workoutTemplateExercises.id })
						.from(s.workoutTemplateExercises)
						.where(isNotNull(s.workoutTemplateExercises.syncedAt))
		).map((row) => row.id);
		const orphanIds = getOrphanSyncedJunctionIds(localSyncedWteIds, pulledWteIds);
		if (orphanIds.length > 0) {
			wteWrote = true;
			await db
				.delete(s.workoutTemplateExercises)
				.where(inArray(s.workoutTemplateExercises.id, orphanIds));
		}

		const sessionsById = new Map(localSessions.map((row) => [row.id, row]));
		const sessionsToWrite = rowsNeedingWrite(
			data.workoutSessions,
			sessionsById,
			(local, row) => local.syncedAt != null && local.updatedAt >= new Date(row.updatedAt)
		);
		for (const chunk of chunkArray(sessionsToWrite, UPSERT_CHUNK_SIZE)) {
			if (chunk.length === 0) continue;
			await db
				.insert(s.workoutSessions)
				.values(
					chunk.map((session) => ({
						id: session.id,
						templateId: session.templateId,
						startedAt: new Date(session.startedAt),
						updatedAt: new Date(session.updatedAt),
						endedAt: session.endedAt ? new Date(session.endedAt) : null,
						notes: session.notes,
						plannedExercises: session.plannedExercises,
						syncedAt
					}))
				)
				.onConflictDoUpdate({
					target: s.workoutSessions.id,
					set: {
						templateId: sql`excluded.template_id`,
						updatedAt: sql`excluded.updated_at`,
						endedAt: sql`excluded.ended_at`,
						notes: sql`excluded.notes`,
						plannedExercises: sql`excluded.planned_exercises`,
						syncedAt
					}
				});
		}

		const logsById = new Map(localLogs.map((row) => [row.id, row]));
		const logsToWrite = rowsNeedingWrite(
			data.loggedExercises,
			logsById,
			(local, row) =>
				local.syncedAt != null &&
				local.sessionId === row.sessionId &&
				local.exerciseId === row.exerciseId &&
				local.fullReps === row.fullReps &&
				local.partialReps === row.partialReps &&
				local.notes === row.notes &&
				local.loggedAt.getTime() === new Date(row.loggedAt).getTime()
		);
		for (const chunk of chunkArray(logsToWrite, UPSERT_CHUNK_SIZE)) {
			if (chunk.length === 0) continue;
			await db
				.insert(s.loggedExercises)
				.values(
					chunk.map((log) => ({
						id: log.id,
						sessionId: log.sessionId,
						exerciseId: log.exerciseId,
						fullReps: log.fullReps,
						partialReps: log.partialReps,
						notes: log.notes,
						loggedAt: new Date(log.loggedAt),
						syncedAt
					}))
				)
				.onConflictDoUpdate({
					target: s.loggedExercises.id,
					set: {
						sessionId: sql`excluded.session_id`,
						exerciseId: sql`excluded.exercise_id`,
						fullReps: sql`excluded.full_reps`,
						partialReps: sql`excluded.partial_reps`,
						notes: sql`excluded.notes`,
						loggedAt: sql`excluded.logged_at`,
						syncedAt
					}
				});
		}

		const lebsById = new Map(localLebs.map((row) => [row.id, row]));
		const lebsToWrite = rowsNeedingWrite(
			data.loggedExerciseBands,
			lebsById,
			(local, row) =>
				local.syncedAt != null &&
				local.loggedExerciseId === row.loggedExerciseId &&
				local.bandId === row.bandId
		);
		for (const chunk of chunkArray(lebsToWrite, UPSERT_CHUNK_SIZE)) {
			if (chunk.length === 0) continue;
			await db
				.insert(s.loggedExerciseBands)
				.values(
					chunk.map((leb) => ({
						id: leb.id,
						loggedExerciseId: leb.loggedExerciseId,
						bandId: leb.bandId,
						syncedAt
					}))
				)
				.onConflictDoUpdate({
					target: s.loggedExerciseBands.id,
					set: {
						loggedExerciseId: sql`excluded.logged_exercise_id`,
						bandId: sql`excluded.band_id`,
						syncedAt
					}
				});
		}

		if (wteWrote) {
			await dedupeTemplateExercisePairs(db);
		}
	}

	// Force a manual sync
	async manualSync() {
		this.clearDebounce();
		this.clearRetry();
		this.retryAttempt = 0;
		await this.fullSync();
	}
}

// Create and export singleton instance
export const syncService = new SyncService();

interface PullResponse {
	bands: Array<{
		id: string;
		name: string;
		nameKey: string | null;
		resistance: number;
		color: string | null;
		seedSlug: string | null;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	}>;
	settings: Array<{
		id: string;
		weightUnit: 'lbs' | 'kg';
		keepScreenAwake: boolean;
		updatedAt: string;
	}>;
	exercises: Array<{
		id: string;
		name: string;
		nameKey: string | null;
		seedSlug: string | null;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	}>;
	workoutTemplates: Array<{
		id: string;
		name: string;
		nameKey: string | null;
		seedSlug: string | null;
		icon: string | null;
		sortOrder: number;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
	}>;
	workoutTemplateExercises: Array<{
		id: string;
		templateId: string;
		exerciseId: string;
		seedSlug: string | null;
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

interface PushResponse {
	syncedAt: string;
	idRemaps?: SyncIdRemaps;
}

interface SyncIdRemaps {
	bands: Record<string, string>;
	exercises: Record<string, string>;
	workoutTemplates: Record<string, string>;
}
