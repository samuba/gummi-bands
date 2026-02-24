import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/server';
import * as s from '$lib/db/server/schema.app';
import { eq, and, gt } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const lastSyncAt = url.searchParams.get('lastSyncAt');
	const syncedAt = new Date().toISOString();

	// Build where clause based on lastSyncAt
	const buildWhere = <T extends { userId: typeof s.bands.userId; updatedAt?: typeof s.bands.updatedAt }>(table: T) => {
		if (lastSyncAt) {
			return and(eq(table.userId, userId), gt(table.updatedAt!, new Date(lastSyncAt)));
		}
		return eq(table.userId, userId);
	};

	// Fetch all records for this user where updatedAt > lastSyncAt
	const [bands, settings, exercises, workoutTemplates, workoutTemplateExercises, workoutSessions, loggedExercises, loggedExerciseBands] = await Promise.all([
		db.select().from(s.bands).where(buildWhere(s.bands)),
		db.select().from(s.settings).where(eq(s.settings.userId, userId)), // Settings doesn't filter by updatedAt
		db.select().from(s.exercises).where(eq(s.exercises.userId, userId)),
		db.select().from(s.workoutTemplates).where(eq(s.workoutTemplates.userId, userId)),
		db.select().from(s.workoutTemplateExercises).where(eq(s.workoutTemplateExercises.userId, userId)), // Junction tables need full sync
		db.select().from(s.workoutSessions).where(eq(s.workoutSessions.userId, userId)),
		db.select().from(s.loggedExercises).where(eq(s.loggedExercises.userId, userId)), // Need all for consistency
		db.select().from(s.loggedExerciseBands).where(eq(s.loggedExerciseBands.userId, userId)) // Need all for consistency
	]);

	return json({
		bands: bands.map(b => ({ ...b, userId: undefined })),
		settings: settings.map(s => ({ id: 'global', ...s, userId: undefined })),
		exercises: exercises.map(e => ({ ...e, userId: undefined })),
		workoutTemplates: workoutTemplates.map(t => ({ ...t, userId: undefined })),
		workoutTemplateExercises: workoutTemplateExercises.map(wte => ({ ...wte, userId: undefined })),
		workoutSessions: workoutSessions.map(s => ({ ...s, userId: undefined })),
		loggedExercises: loggedExercises.map(le => ({ ...le, userId: undefined })),
		loggedExerciseBands: loggedExerciseBands.map(leb => ({ ...leb, userId: undefined })),
		syncedAt
	});
};
