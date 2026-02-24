import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { db } from '$lib/db/server';
import * as s from '$lib/db/server/schema.app';
import * as localSchema from '$lib/db/app/schema';
import { eq } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-valibot';

// Date schemas that coerce ISO strings to Date objects
const dateSchema = v.pipe(
	v.union([v.string(), v.date()]),
	v.transform((val) => (typeof val === 'string' ? new Date(val) : val))
);
const nullableDateSchema = v.nullable(dateSchema);

// Generate schemas from local Drizzle tables, omitting syncedAt (local-only)
const BandSchema = v.omit(createSelectSchema(localSchema.bands, {
	createdAt: dateSchema,
	updatedAt: dateSchema,
	deletedAt: nullableDateSchema
}), ['syncedAt']);
const SettingsSchema = v.omit(createSelectSchema(localSchema.settings, { updatedAt: dateSchema }), ['syncedAt']);
const ExerciseSchema = v.omit(createSelectSchema(localSchema.exercises, {
	createdAt: dateSchema,
	updatedAt: dateSchema,
	deletedAt: nullableDateSchema
}), ['syncedAt']);
const WorkoutTemplateSchema = v.omit(
	createSelectSchema(localSchema.workoutTemplates, {
		createdAt: dateSchema,
		updatedAt: dateSchema
	}),
	['syncedAt']
);
const WorkoutTemplateExerciseSchema = v.omit(createSelectSchema(localSchema.workoutTemplateExercises), ['syncedAt']);
const WorkoutSessionSchema = v.omit(
	createSelectSchema(localSchema.workoutSessions, {
		startedAt: dateSchema,
		updatedAt: dateSchema,
		endedAt: nullableDateSchema
	}),
	['syncedAt']
);
const LoggedExerciseSchema = v.omit(createSelectSchema(localSchema.loggedExercises, { loggedAt: dateSchema }), ['syncedAt']);
const LoggedExerciseBandSchema = v.omit(createSelectSchema(localSchema.loggedExerciseBands), ['syncedAt']);

const SyncPayloadSchema = v.object({
	bands: v.optional(v.array(BandSchema)),
	settings: v.optional(v.array(SettingsSchema)),
	exercises: v.optional(v.array(ExerciseSchema)),
	workoutTemplates: v.optional(v.array(WorkoutTemplateSchema)),
	workoutTemplateExercises: v.optional(v.array(WorkoutTemplateExerciseSchema)),
	workoutSessions: v.optional(v.array(WorkoutSessionSchema)),
	loggedExercises: v.optional(v.array(LoggedExerciseSchema)),
	loggedExerciseBands: v.optional(v.array(LoggedExerciseBandSchema))
});

function omitId<T extends { id: string }>(row: T): Omit<T, 'id'> {
	const { id, ...rest } = row;
	void id;
	return rest;
}

function ensureWriteApplied(result: Array<{ id: string }>, entity: string, id: string) {
	if (result.length > 0) return;
	error(409, `${entity} id conflict for id ${id}`);
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const body = await request.json();
	
	const result = v.safeParse(SyncPayloadSchema, body);
	if (!result.success) {
		error(400, 'Invalid payload');
	}
	
	const payload = result.output;
	const syncedAt = new Date().toISOString();

	if (payload.bands?.length) {
		for (const band of payload.bands) {
			if (band.seedSlug) {
				const setValues = omitId(band);
				await db.insert(s.bands)
					.values({ ...band, userId })
					.onConflictDoUpdate({
						target: [s.bands.userId, s.bands.seedSlug],
						set: { ...setValues, userId }
					});
				continue;
			}

			const result = await db.insert(s.bands)
				.values({ ...band, userId })
				.onConflictDoUpdate({
					target: s.bands.id,
					set: { ...band, userId },
					setWhere: eq(s.bands.userId, userId)
				})
				.returning({ id: s.bands.id });
			ensureWriteApplied(result, 'band', band.id);
		}
	}

	if (payload.settings?.length) {
		for (const setting of payload.settings) {
			const settingValues = omitId(setting);
			await db.insert(s.settings)
				.values({ ...settingValues, userId })
				.onConflictDoUpdate({
					target: s.settings.userId,
					set: { ...settingValues, userId }
				});
		}
	}

	if (payload.exercises?.length) {
		for (const exercise of payload.exercises) {
			if (exercise.seedSlug) {
				const setValues = omitId(exercise);
				await db.insert(s.exercises)
					.values({ ...exercise, userId })
					.onConflictDoUpdate({
						target: [s.exercises.userId, s.exercises.seedSlug],
						set: { ...setValues, userId }
					});
				continue;
			}

			const result = await db.insert(s.exercises)
				.values({ ...exercise, userId })
				.onConflictDoUpdate({
					target: s.exercises.id,
					set: { ...exercise, userId },
					setWhere: eq(s.exercises.userId, userId)
				})
				.returning({ id: s.exercises.id });
			ensureWriteApplied(result, 'exercise', exercise.id);
		}
	}

	if (payload.workoutTemplates?.length) {
		for (const template of payload.workoutTemplates) {
			if (template.seedSlug) {
				const setValues = omitId(template);
				await db.insert(s.workoutTemplates)
					.values({ ...template, userId })
					.onConflictDoUpdate({
						target: [s.workoutTemplates.userId, s.workoutTemplates.seedSlug],
						set: { ...setValues, userId }
					});
				continue;
			}

			const result = await db.insert(s.workoutTemplates)
				.values({ ...template, userId })
				.onConflictDoUpdate({
					target: s.workoutTemplates.id,
					set: { ...template, userId },
					setWhere: eq(s.workoutTemplates.userId, userId)
				})
				.returning({ id: s.workoutTemplates.id });
			ensureWriteApplied(result, 'workout template', template.id);
		}
	}

	if (payload.workoutTemplateExercises?.length) {
		for (const wte of payload.workoutTemplateExercises) {
			if (wte.seedSlug) {
				const setValues = omitId(wte);
				await db.insert(s.workoutTemplateExercises)
					.values({ ...wte, userId })
					.onConflictDoUpdate({
						target: [s.workoutTemplateExercises.userId, s.workoutTemplateExercises.seedSlug],
						set: { ...setValues, userId }
					});
				continue;
			}

			const result = await db.insert(s.workoutTemplateExercises)
				.values({ ...wte, userId })
				.onConflictDoUpdate({
					target: s.workoutTemplateExercises.id,
					set: { ...wte, userId },
					setWhere: eq(s.workoutTemplateExercises.userId, userId)
				})
				.returning({ id: s.workoutTemplateExercises.id });
			ensureWriteApplied(result, 'workout template exercise', wte.id);
		}
	}

	if (payload.workoutSessions?.length) {
		for (const session of payload.workoutSessions) {
			const result = await db.insert(s.workoutSessions)
				.values({ ...session, userId })
				.onConflictDoUpdate({
					target: s.workoutSessions.id,
					set: { ...session, userId },
					setWhere: eq(s.workoutSessions.userId, userId)
				})
				.returning({ id: s.workoutSessions.id });
			ensureWriteApplied(result, 'workout session', session.id);
		}
	}

	if (payload.loggedExercises?.length) {
		for (const loggedExercise of payload.loggedExercises) {
			const result = await db.insert(s.loggedExercises)
				.values({ ...loggedExercise, userId })
				.onConflictDoUpdate({
					target: s.loggedExercises.id,
					set: { ...loggedExercise, userId },
					setWhere: eq(s.loggedExercises.userId, userId)
				})
				.returning({ id: s.loggedExercises.id });
			ensureWriteApplied(result, 'logged exercise', loggedExercise.id);
		}
	}

	if (payload.loggedExerciseBands?.length) {
		for (const loggedExerciseBand of payload.loggedExerciseBands) {
			const result = await db.insert(s.loggedExerciseBands)
				.values({ ...loggedExerciseBand, userId })
				.onConflictDoUpdate({
					target: s.loggedExerciseBands.id,
					set: { ...loggedExerciseBand, userId },
					setWhere: eq(s.loggedExerciseBands.userId, userId)
				})
				.returning({ id: s.loggedExerciseBands.id });
			ensureWriteApplied(result, 'logged exercise band', loggedExerciseBand.id);
		}
	}

	return json({ syncedAt });
};
