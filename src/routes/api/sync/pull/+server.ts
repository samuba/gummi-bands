import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/server';
import * as s from '$lib/db/server/schema.app';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { repairServerCatalogDuplicates } from '$lib/db/server/catalogMerge';
import {
	shouldPullAllLoggedExerciseBands,
	shouldRepairCatalogOnPull
} from '$lib/services/syncHelpers';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const lastSyncAt = url.searchParams.get('lastSyncAt');
	const syncedAt = new Date().toISOString();
	const since = lastSyncAt ? new Date(lastSyncAt) : null;

	if (shouldRepairCatalogOnPull(lastSyncAt)) {
		await repairServerCatalogDuplicates(userId);
	}

	const [
		bands,
		settings,
		exercises,
		workoutTemplates,
		workoutTemplateExercises,
		workoutSessions,
		loggedExercises
	] = await Promise.all([
		db
			.select()
			.from(s.bands)
			.where(
				since
					? and(eq(s.bands.userId, userId), gt(s.bands.updatedAt, since))
					: eq(s.bands.userId, userId)
			),
		db
			.select()
			.from(s.settings)
			.where(
				since
					? and(eq(s.settings.userId, userId), gt(s.settings.updatedAt, since))
					: eq(s.settings.userId, userId)
			),
		db
			.select()
			.from(s.exercises)
			.where(
				since
					? and(eq(s.exercises.userId, userId), gt(s.exercises.updatedAt, since))
					: eq(s.exercises.userId, userId)
			),
		db
			.select()
			.from(s.workoutTemplates)
			.where(
				since
					? and(eq(s.workoutTemplates.userId, userId), gt(s.workoutTemplates.updatedAt, since))
					: eq(s.workoutTemplates.userId, userId)
			),
		// Always full — client orphan cleanup needs the complete junction set.
		db
			.select()
			.from(s.workoutTemplateExercises)
			.where(eq(s.workoutTemplateExercises.userId, userId)),
		db
			.select()
			.from(s.workoutSessions)
			.where(
				since
					? and(eq(s.workoutSessions.userId, userId), gt(s.workoutSessions.updatedAt, since))
					: eq(s.workoutSessions.userId, userId)
			),
		db
			.select()
			.from(s.loggedExercises)
			.where(
				since
					? and(eq(s.loggedExercises.userId, userId), gt(s.loggedExercises.loggedAt, since))
					: eq(s.loggedExercises.userId, userId)
			)
	]);

	let loggedExerciseBands: (typeof s.loggedExerciseBands.$inferSelect)[];
	if (
		shouldPullAllLoggedExerciseBands({
			isFirstSync: !since,
			pulledBandCount: bands.length
		})
	) {
		loggedExerciseBands = await db
			.select()
			.from(s.loggedExerciseBands)
			.where(eq(s.loggedExerciseBands.userId, userId));
	} else if (loggedExercises.length === 0) {
		loggedExerciseBands = [];
	} else {
		loggedExerciseBands = await db
			.select()
			.from(s.loggedExerciseBands)
			.where(
				and(
					eq(s.loggedExerciseBands.userId, userId),
					inArray(
						s.loggedExerciseBands.loggedExerciseId,
						loggedExercises.map((le) => le.id)
					)
				)
			);
	}

	return json({
		bands: bands.map((b) => ({ ...b, userId: undefined })),
		settings: settings.map((row) => ({ id: 'global', ...row, userId: undefined })),
		exercises: exercises.map((e) => ({ ...e, userId: undefined })),
		workoutTemplates: workoutTemplates.map((t) => ({ ...t, userId: undefined })),
		workoutTemplateExercises: workoutTemplateExercises.map((wte) => ({
			...wte,
			userId: undefined
		})),
		workoutSessions: workoutSessions.map((row) => ({ ...row, userId: undefined })),
		loggedExercises: loggedExercises.map((le) => ({ ...le, userId: undefined })),
		loggedExerciseBands: loggedExerciseBands.map((leb) => ({ ...leb, userId: undefined })),
		syncedAt
	});
};
