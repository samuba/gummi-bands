import { and, eq, ne, sql } from 'drizzle-orm';
import { getCatalogNameKey } from '$lib/db/catalog';
import * as s from './schema';
import type { Db } from './client';
import type { Band, Exercise, WorkoutTemplate, WorkoutTemplateExercise } from './schema';

export async function repairLocalCatalogDuplicates(db: Db) {
	await mergeDuplicateBands(db);
	await mergeDuplicateExercises(db);
	await mergeDuplicateTemplates(db);
	await dedupeTemplateExercisePairs(db);
}

export async function remapLocalBandId(db: Db, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.loggedExerciseBands)
		.set({ bandId: newId, syncedAt: null })
		.where(eq(s.loggedExerciseBands.bandId, oldId));
}

export async function remapLocalExerciseId(db: Db, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.workoutTemplateExercises)
		.set({ exerciseId: newId, syncedAt: null })
		.where(eq(s.workoutTemplateExercises.exerciseId, oldId));
	await db
		.update(s.loggedExercises)
		.set({ exerciseId: newId, syncedAt: null })
		.where(eq(s.loggedExercises.exerciseId, oldId));
}

export async function remapLocalTemplateId(db: Db, oldId: string, newId: string) {
	if (oldId === newId) return;

	await db
		.update(s.workoutTemplateExercises)
		.set({ templateId: newId, syncedAt: null })
		.where(eq(s.workoutTemplateExercises.templateId, oldId));
	await db
		.update(s.workoutSessions)
		.set({ templateId: newId, updatedAt: sql`now()`, syncedAt: null })
		.where(eq(s.workoutSessions.templateId, oldId));
}

export async function dedupeTemplateExercisePairs(db: Db) {
	const rows = await db.select().from(s.workoutTemplateExercises);
	const rowsByPair = groupBy(rows, (row) => `${row.templateId}:${row.exerciseId}`);

	for (const pairRows of Object.values(rowsByPair)) {
		if (pairRows.length < 2) continue;

		const [canonical, ...duplicates] = pairRows.sort(compareTemplateExerciseRows);
		for (const duplicate of duplicates) {
			if (duplicate.id === canonical.id) continue;
			await db
				.delete(s.workoutTemplateExercises)
				.where(eq(s.workoutTemplateExercises.id, duplicate.id));
		}
	}
}

async function mergeDuplicateBands(db: Db) {
	const rows = await db.select().from(s.bands);
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);

		for (const duplicate of duplicates) {
			await remapLocalBandId(db, duplicate.id, canonical.id);
			await db.delete(s.bands).where(eq(s.bands.id, duplicate.id));
		}

		if (duplicates.length === 0 && canonical.nameKey === nameKey && canonical.seedSlug === seedSlug)
			continue;

		await db
			.update(s.bands)
			.set({
				nameKey,
				seedSlug,
				syncedAt: null
			})
			.where(eq(s.bands.id, canonical.id));
	}
}

async function mergeDuplicateExercises(db: Db) {
	const rows = await db.select().from(s.exercises);
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);

		for (const duplicate of duplicates) {
			await remapLocalExerciseId(db, duplicate.id, canonical.id);
			await db.delete(s.exercises).where(eq(s.exercises.id, duplicate.id));
		}

		if (duplicates.length === 0 && canonical.nameKey === nameKey && canonical.seedSlug === seedSlug)
			continue;

		await db
			.update(s.exercises)
			.set({
				nameKey,
				seedSlug,
				syncedAt: null
			})
			.where(eq(s.exercises.id, canonical.id));
	}
}

async function mergeDuplicateTemplates(db: Db) {
	const rows = await db.select().from(s.workoutTemplates);
	const rowsByName = groupBy(rows, (row) => getCatalogNameKey(row.name));

	for (const groupRows of Object.values(rowsByName)) {
		const [canonical, ...duplicates] = sortCatalogRows(groupRows);
		const nameKey = getCatalogNameKey(canonical.name);
		const seedSlug = firstValue([canonical, ...duplicates], (row) => row.seedSlug);
		const icon = firstValue([canonical, ...duplicates], (row) => row.icon);
		const sortOrder = Math.min(...[canonical, ...duplicates].map((row) => row.sortOrder));

		for (const duplicate of duplicates) {
			await remapLocalTemplateId(db, duplicate.id, canonical.id);
			await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, duplicate.id));
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
			.set({
				nameKey,
				seedSlug,
				icon,
				sortOrder,
				syncedAt: null
			})
			.where(eq(s.workoutTemplates.id, canonical.id));
	}
}

export async function mergeBandIntoExistingName(
	db: Db,
	id: string,
	name: string,
	resistance: number,
	color?: string
) {
	const nameKey = getCatalogNameKey(name);
	const existing = await db.query.bands.findFirst({
		where: and(eq(s.bands.nameKey, nameKey), ne(s.bands.id, id))
	});

	if (!existing) return null;

	await remapLocalBandId(db, id, existing.id);
	await db
		.update(s.bands)
		.set({ name, nameKey, resistance, ...(color !== undefined && { color }), deletedAt: null })
		.where(eq(s.bands.id, existing.id));
	await db.delete(s.bands).where(eq(s.bands.id, id));

	return existing.id;
}

export async function mergeTemplateIntoExistingName(
	db: Db,
	id: string,
	name: string,
	exerciseIds: string[]
) {
	const nameKey = getCatalogNameKey(name);
	const existing = await db.query.workoutTemplates.findFirst({
		where: and(eq(s.workoutTemplates.nameKey, nameKey), ne(s.workoutTemplates.id, id))
	});

	if (!existing) return null;

	await remapLocalTemplateId(db, id, existing.id);
	await replaceTemplateExercises(db, existing.id, exerciseIds);
	await db
		.update(s.workoutTemplates)
		.set({ name, nameKey, deletedAt: null })
		.where(eq(s.workoutTemplates.id, existing.id));
	await db.delete(s.workoutTemplates).where(eq(s.workoutTemplates.id, id));

	return existing.id;
}

export async function replaceTemplateExercises(db: Db, templateId: string, exerciseIds: string[]) {
	await db
		.delete(s.workoutTemplateExercises)
		.where(eq(s.workoutTemplateExercises.templateId, templateId));

	if (exerciseIds.length === 0) return;

	await db.insert(s.workoutTemplateExercises).values(
		exerciseIds.map((exerciseId, index) => ({
			templateId,
			exerciseId,
			sortOrder: index
		}))
	);
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

function compareTemplateExerciseRows(a: WorkoutTemplateExercise, b: WorkoutTemplateExercise) {
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

type CatalogRow = Band | Exercise | WorkoutTemplate;
