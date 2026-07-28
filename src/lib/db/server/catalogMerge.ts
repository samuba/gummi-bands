import { and, eq, sql } from 'drizzle-orm';
import { getCatalogNameKey } from '$lib/db/catalog';
import { db } from '$lib/db/server';
import * as s from './schema.app';
import type { bands, exercises, workoutTemplates, workoutTemplateExercises } from './schema.app';

export async function repairServerCatalogDuplicates(userId: string) {
	await mergeDuplicateBands(userId);
	await mergeDuplicateExercises(userId);
	await mergeDuplicateTemplates(userId);
	await dedupeServerTemplateExercisePairs(userId);
}

export async function remapServerBandId(userId: string, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.loggedExerciseBands)
		.set({ bandId: newId })
		.where(and(eq(s.loggedExerciseBands.userId, userId), eq(s.loggedExerciseBands.bandId, oldId)));
}

export async function remapServerExerciseId(userId: string, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.workoutTemplateExercises)
		.set({ exerciseId: newId })
		.where(
			and(
				eq(s.workoutTemplateExercises.userId, userId),
				eq(s.workoutTemplateExercises.exerciseId, oldId)
			)
		);
	await db
		.update(s.loggedExercises)
		.set({ exerciseId: newId })
		.where(and(eq(s.loggedExercises.userId, userId), eq(s.loggedExercises.exerciseId, oldId)));
}

export async function remapServerTemplateId(userId: string, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.workoutTemplateExercises)
		.set({ templateId: newId })
		.where(
			and(
				eq(s.workoutTemplateExercises.userId, userId),
				eq(s.workoutTemplateExercises.templateId, oldId)
			)
		);
	await db
		.update(s.workoutSessions)
		.set({ templateId: newId, updatedAt: sql`now()` })
		.where(and(eq(s.workoutSessions.userId, userId), eq(s.workoutSessions.templateId, oldId)));
}

export async function dedupeServerTemplateExercisePairs(userId: string) {
	const rows = await db
		.select()
		.from(s.workoutTemplateExercises)
		.where(eq(s.workoutTemplateExercises.userId, userId));
	const rowsByPair = groupBy(rows, (row) => `${row.templateId}:${row.exerciseId}`);

	for (const pairRows of Object.values(rowsByPair)) {
		if (pairRows.length < 2) continue;

		const [canonical, ...duplicates] = pairRows.sort(compareTemplateExerciseRows);
		for (const duplicate of duplicates) {
			if (duplicate.id === canonical.id) continue;

			await db
				.delete(s.workoutTemplateExercises)
				.where(
					and(
						eq(s.workoutTemplateExercises.userId, userId),
						eq(s.workoutTemplateExercises.id, duplicate.id)
					)
				);
		}
	}
}

async function mergeDuplicateBands(userId: string) {
	const rows = await db.select().from(s.bands).where(eq(s.bands.userId, userId));
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);

		for (const duplicate of duplicates) {
			await remapServerBandId(userId, duplicate.id, canonical.id);
			await db.delete(s.bands).where(and(eq(s.bands.userId, userId), eq(s.bands.id, duplicate.id)));
		}

		if (duplicates.length === 0 && canonical.nameKey === nameKey && canonical.seedSlug === seedSlug)
			continue;

		await db
			.update(s.bands)
			.set({
				nameKey,
				seedSlug,
				// Bump so incremental pulls include this band and re-fetch LEBs.
				updatedAt: sql`now()`
			})
			.where(and(eq(s.bands.userId, userId), eq(s.bands.id, canonical.id)));
	}
}

async function mergeDuplicateExercises(userId: string) {
	const rows = await db.select().from(s.exercises).where(eq(s.exercises.userId, userId));
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);

		for (const duplicate of duplicates) {
			await remapServerExerciseId(userId, duplicate.id, canonical.id);
			await db
				.delete(s.exercises)
				.where(and(eq(s.exercises.userId, userId), eq(s.exercises.id, duplicate.id)));
		}

		if (duplicates.length === 0 && canonical.nameKey === nameKey && canonical.seedSlug === seedSlug)
			continue;

		await db
			.update(s.exercises)
			.set({ nameKey, seedSlug, updatedAt: sql`now()` })
			.where(and(eq(s.exercises.userId, userId), eq(s.exercises.id, canonical.id)));
	}
}

async function mergeDuplicateTemplates(userId: string) {
	const rows = await db
		.select()
		.from(s.workoutTemplates)
		.where(eq(s.workoutTemplates.userId, userId));
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);
		const icon = firstValue([canonical, ...duplicates], (row) => row.icon);
		const sortOrder = Math.min(...[canonical, ...duplicates].map((row) => row.sortOrder));

		for (const duplicate of duplicates) {
			await remapServerTemplateId(userId, duplicate.id, canonical.id);
			await db
				.delete(s.workoutTemplates)
				.where(and(eq(s.workoutTemplates.userId, userId), eq(s.workoutTemplates.id, duplicate.id)));
		}

		if (
			duplicates.length === 0 &&
			canonical.nameKey === nameKey &&
			canonical.seedSlug === seedSlug &&
			canonical.icon === icon &&
			canonical.sortOrder === sortOrder
		)
			continue;

		await db
			.update(s.workoutTemplates)
			.set({ nameKey, seedSlug, icon, sortOrder, updatedAt: sql`now()` })
			.where(and(eq(s.workoutTemplates.userId, userId), eq(s.workoutTemplates.id, canonical.id)));
	}
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
	return rows.reduce<Record<string, T[]>>((groups, row) => {
		const key = getKey(row);
		groups[key] = [...(groups[key] ?? []), row];
		return groups;
	}, {});
}

function sortCatalogRows<T extends CatalogRow>(rows: T[]) {
	return [...rows].sort((a, b) => {
		if (!!a.deletedAt !== !!b.deletedAt) {
			return a.deletedAt ? 1 : -1;
		}

		return b.updatedAt.getTime() - a.updatedAt.getTime();
	});
}

function compareTemplateExerciseRows(
	a: typeof workoutTemplateExercises.$inferSelect,
	b: typeof workoutTemplateExercises.$inferSelect
) {
	if (a.seedSlug && !b.seedSlug) return -1;
	if (!a.seedSlug && b.seedSlug) return 1;

	return a.sortOrder - b.sortOrder;
}

function firstValue<T, V>(rows: T[], getValue: (row: T) => V | null) {
	for (const row of rows) {
		const value = getValue(row);
		if (value !== null) return value;
	}

	return null;
}

type CatalogRow =
	| typeof bands.$inferSelect
	| typeof exercises.$inferSelect
	| typeof workoutTemplates.$inferSelect;
