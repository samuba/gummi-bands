/**
 * Template exercise junction replace should only run for templates whose
 * exercise list was explicitly edited — never for metadata-only dirty rows.
 * Also skip replace when the local set is empty unless the caller marked an
 * intentional clear (emptyAllowed).
 */
export function getSafeReplacementTemplateIds(options: {
	markedTemplateIds: Iterable<string>;
	localExerciseCountsByTemplateId: Map<string, number>;
	allowEmptyReplace?: boolean;
}): string[] {
	const allowEmptyReplace = options.allowEmptyReplace ?? false;
	const ids: string[] = [];

	for (const templateId of options.markedTemplateIds) {
		const count = options.localExerciseCountsByTemplateId.get(templateId) ?? 0;
		if (count === 0 && !allowEmptyReplace) continue;
		ids.push(templateId);
	}

	return ids;
}

/** Synced local junction rows that are missing from a full server pull are orphans. */
export function getOrphanSyncedJunctionIds(
	localSyncedIds: Iterable<string>,
	pulledIds: Iterable<string>
): string[] {
	const pulled = new Set(pulledIds);
	const orphans: string[] = [];

	for (const id of localSyncedIds) {
		if (!pulled.has(id)) orphans.push(id);
	}

	return orphans;
}

/** Resolve exercise rows from planned IDs, preserving order and skipping missing. */
export function resolveExercisesByPlannedIds<T extends { id: string }>(
	plannedIds: string[],
	exercisesById: Map<string, T>
): T[] {
	const resolved: T[] = [];

	for (const id of plannedIds) {
		const exercise = exercisesById.get(id);
		if (!exercise) continue;
		if (resolved.some((item) => item.id === exercise.id)) continue;
		resolved.push(exercise);
	}

	return resolved;
}

/** Collect primary keys from rows that were included in a push payload. */
export function idsOf<T extends { id: string }>(rows: T[]): string[] {
	return rows.map((row) => row.id);
}

/**
 * Map local IDs through server remaps and dedupe. Used so syncedAt is set on
 * rows that still exist after catalog merge remaps delete the pushed id.
 */
export function resolveRemappedIds(
	ids: Iterable<string>,
	remaps?: Record<string, string>
): string[] {
	const result: string[] = [];
	const seen = new Set<string>();

	for (const id of ids) {
		const resolved = remaps?.[id] ?? id;
		if (seen.has(resolved)) continue;
		seen.add(resolved);
		result.push(resolved);
	}

	return result;
}

/**
 * Mark-as-synced targets after push remaps.
 * - Non-remapped: keep snapshot updatedAt so a concurrent local edit stays dirty.
 * - Remapped: mark canonical id unconditionally (pushed local row was deleted).
 */
export function resolveSyncedMarkTargets(
	rows: ReadonlyArray<{ id: string; updatedAt: Date }>,
	remaps?: Record<string, string>
): Array<{ id: string; updatedAt: Date | null }> {
	const result: Array<{ id: string; updatedAt: Date | null }> = [];
	const seen = new Set<string>();

	for (const row of rows) {
		const remapped = remaps?.[row.id];
		const id = remapped ?? row.id;
		if (seen.has(id)) continue;
		seen.add(id);
		const wasRemapped = remapped != null && remapped !== row.id;
		result.push({ id, updatedAt: wasRemapped ? null : row.updatedAt });
	}

	return result;
}

/** Catalog repair is only needed on first pull; later pulls are incremental. */
export function shouldRepairCatalogOnPull(lastSyncAt: string | null | undefined): boolean {
	return !lastSyncAt;
}

/**
 * Whether a push must run even when junction/row payloads look empty —
 * e.g. intentional clear-all of a template's exercises.
 */
export function hasPushWork(options: {
	rowCounts: number[];
	replacementTemplateIds: readonly string[];
}): boolean {
	if (options.replacementTemplateIds.length > 0) return true;
	return options.rowCounts.some((count) => count > 0);
}

/** Exponential backoff delay for sync retries, capped at maxMs. */
export function syncRetryDelayMs(attempt: number, baseMs: number, maxMs: number): number {
	const safeAttempt = Math.max(0, attempt);
	return Math.min(baseMs * 2 ** safeAttempt, maxMs);
}

/** Split rows for batched inserts/upserts. */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
	if (size <= 0) return [items.slice()];
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

/** Keep only incoming rows that are missing locally or have changed. */
export function rowsNeedingWrite<T extends { id: string }, L extends { id: string }>(
	incoming: readonly T[],
	localById: Map<string, L>,
	isUnchanged: (local: L, row: T) => boolean
): T[] {
	const out: T[] = [];
	for (const row of incoming) {
		const local = localById.get(row.id);
		if (local && isUnchanged(local, row)) continue;
		out.push(row);
	}
	return out;
}

/**
 * Full LEB pull is required on first sync and whenever bands changed —
 * catalog remaps can rewrite LEB.bandId without touching loggedAt.
 */
export function shouldPullAllLoggedExerciseBands(options: {
	isFirstSync: boolean;
	pulledBandCount: number;
}): boolean {
	return options.isFirstSync || options.pulledBandCount > 0;
}
