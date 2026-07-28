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
