import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { db } from '$lib/db/server';
import * as s from '$lib/db/server/schema.app';
import * as localSchema from '$lib/db/app/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-valibot';
import { getCatalogNameKey } from '$lib/db/catalog';
import {
	dedupeServerTemplateExercisePairs,
	remapServerBandId,
	remapServerExerciseId,
	remapServerTemplateId,
	repairServerCatalogDuplicates
} from '$lib/db/server/catalogMerge';

// Date schemas that coerce ISO strings to Date objects
const dateSchema = v.pipe(
	v.union([v.string(), v.date()]),
	v.transform((val) => (typeof val === 'string' ? new Date(val) : val))
);
const nullableDateSchema = v.nullable(dateSchema);

// Generate schemas from local Drizzle tables, omitting syncedAt (local-only)
const BandSchema = v.omit(
	createSelectSchema(localSchema.bands, {
		createdAt: dateSchema,
		updatedAt: dateSchema,
		deletedAt: nullableDateSchema
	}),
	['syncedAt']
);
const SettingsSchema = v.omit(createSelectSchema(localSchema.settings, { updatedAt: dateSchema }), [
	'syncedAt'
]);
const ExerciseSchema = v.omit(
	createSelectSchema(localSchema.exercises, {
		createdAt: dateSchema,
		updatedAt: dateSchema,
		deletedAt: nullableDateSchema
	}),
	['syncedAt']
);
const WorkoutTemplateSchema = v.omit(
	createSelectSchema(localSchema.workoutTemplates, {
		createdAt: dateSchema,
		updatedAt: dateSchema,
		deletedAt: nullableDateSchema
	}),
	['syncedAt']
);
const WorkoutTemplateExerciseSchema = v.omit(
	createSelectSchema(localSchema.workoutTemplateExercises),
	['syncedAt']
);
const WorkoutSessionSchema = v.omit(
	createSelectSchema(localSchema.workoutSessions, {
		startedAt: dateSchema,
		updatedAt: dateSchema,
		endedAt: nullableDateSchema
	}),
	['syncedAt']
);
const LoggedExerciseSchema = v.omit(
	createSelectSchema(localSchema.loggedExercises, { loggedAt: dateSchema }),
	['syncedAt']
);
const LoggedExerciseBandSchema = v.omit(createSelectSchema(localSchema.loggedExerciseBands), [
	'syncedAt'
]);

const SyncPayloadSchema = v.object({
	bands: v.optional(v.array(BandSchema)),
	settings: v.optional(v.array(SettingsSchema)),
	exercises: v.optional(v.array(ExerciseSchema)),
	workoutTemplates: v.optional(v.array(WorkoutTemplateSchema)),
	replaceWorkoutTemplateExercisesForTemplateIds: v.optional(v.array(v.string())),
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

/**
 * Server rows have two uniqueness constraints: the primary key `id` and the
 * composite `(user_id, seed_slug)` unique index. A single ON CONFLICT clause can
 * only target one of them, so if a client pushes a row whose id exists on the
 * server but with a different (or null) seed_slug, Postgres raises a pkey
 * conflict that the `(user_id, seed_slug)` target cannot catch. To avoid this,
 * we null out the seed_slug on any other row that holds the incoming slug
 * before upserting by id. The affected row's next pull will then reconcile.
 */
async function clearConflictingSeedSlug(
	table: PgTable & { id: PgColumn; userId: PgColumn; seedSlug: PgColumn },
	userId: string,
	rowId: string,
	seedSlug: string
) {
	await db
		.update(table)
		.set({ seedSlug: null })
		.where(and(eq(table.userId, userId), eq(table.seedSlug, seedSlug), ne(table.id, rowId)));
}

export const POST: RequestHandler = async (event) => {
	try {
		return await handlePush(event);
	} catch (err) {
		if (err instanceof Error) {
			const cause = (err as Error & { cause?: unknown }).cause;
			if (cause instanceof Error) {
				console.error('[sync/push] underlying cause:', cause.message, cause.stack);
			}
		}
		throw err;
	}
};

async function handlePush({ locals, request }: Parameters<RequestHandler>[0]) {
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
	const idRemaps: SyncIdRemaps = { bands: {}, exercises: {}, workoutTemplates: {} };

	await repairServerCatalogDuplicates(userId);

	if (payload.bands?.length) {
		for (const band of payload.bands) {
			const nameKey = getCatalogNameKey(band.name);
			const existingByName = await db.query.bands.findFirst({
				where: and(
					eq(s.bands.userId, userId),
					eq(s.bands.nameKey, nameKey),
					ne(s.bands.id, band.id)
				)
			});

			if (existingByName) {
				idRemaps.bands[band.id] = existingByName.id;
				await remapServerBandId(userId, band.id, existingByName.id);
				if (band.updatedAt >= existingByName.updatedAt) {
					await db
						.update(s.bands)
						.set({ ...band, id: existingByName.id, userId, nameKey })
						.where(and(eq(s.bands.userId, userId), eq(s.bands.id, existingByName.id)));
				}
				continue;
			}

			if (band.seedSlug) {
				await clearConflictingSeedSlug(s.bands, userId, band.id, band.seedSlug);
			}
			const result = await db
				.insert(s.bands)
				.values({ ...band, userId, nameKey })
				.onConflictDoUpdate({
					target: s.bands.id,
					set: { ...band, userId, nameKey },
					setWhere: eq(s.bands.userId, userId)
				})
				.returning({ id: s.bands.id });
			ensureWriteApplied(result, 'band', band.id);
		}
	}

	if (payload.settings?.length) {
		for (const setting of payload.settings) {
			const settingValues = omitId(setting);
			await db
				.insert(s.settings)
				.values({ ...settingValues, userId })
				.onConflictDoUpdate({
					target: s.settings.userId,
					set: { ...settingValues, userId }
				});
		}
	}

	if (payload.exercises?.length) {
		for (const exercise of payload.exercises) {
			const nameKey = getCatalogNameKey(exercise.name);
			const existingByName = await db.query.exercises.findFirst({
				where: and(
					eq(s.exercises.userId, userId),
					eq(s.exercises.nameKey, nameKey),
					ne(s.exercises.id, exercise.id)
				)
			});

			if (existingByName) {
				idRemaps.exercises[exercise.id] = existingByName.id;
				await remapServerExerciseId(userId, exercise.id, existingByName.id);
				if (exercise.updatedAt >= existingByName.updatedAt) {
					await db
						.update(s.exercises)
						.set({ ...exercise, id: existingByName.id, userId, nameKey })
						.where(and(eq(s.exercises.userId, userId), eq(s.exercises.id, existingByName.id)));
				}
				continue;
			}

			if (exercise.seedSlug) {
				await clearConflictingSeedSlug(s.exercises, userId, exercise.id, exercise.seedSlug);
			}
			const result = await db
				.insert(s.exercises)
				.values({ ...exercise, userId, nameKey })
				.onConflictDoUpdate({
					target: s.exercises.id,
					set: { ...exercise, userId, nameKey },
					setWhere: eq(s.exercises.userId, userId)
				})
				.returning({ id: s.exercises.id });
			ensureWriteApplied(result, 'exercise', exercise.id);
		}
	}

	if (payload.workoutTemplates?.length) {
		for (const template of payload.workoutTemplates) {
			const nameKey = getCatalogNameKey(template.name);
			const existingByName = await db.query.workoutTemplates.findFirst({
				where: and(
					eq(s.workoutTemplates.userId, userId),
					eq(s.workoutTemplates.nameKey, nameKey),
					ne(s.workoutTemplates.id, template.id)
				)
			});

			if (existingByName) {
				idRemaps.workoutTemplates[template.id] = existingByName.id;
				await remapServerTemplateId(userId, template.id, existingByName.id);
				if (template.updatedAt >= existingByName.updatedAt) {
					await db
						.update(s.workoutTemplates)
						.set({ ...template, id: existingByName.id, userId, nameKey })
						.where(
							and(
								eq(s.workoutTemplates.userId, userId),
								eq(s.workoutTemplates.id, existingByName.id)
							)
						);
				}
				continue;
			}

			if (template.seedSlug) {
				await clearConflictingSeedSlug(s.workoutTemplates, userId, template.id, template.seedSlug);
			}
			const result = await db
				.insert(s.workoutTemplates)
				.values({ ...template, userId, nameKey })
				.onConflictDoUpdate({
					target: s.workoutTemplates.id,
					set: { ...template, userId, nameKey },
					setWhere: eq(s.workoutTemplates.userId, userId)
				})
				.returning({ id: s.workoutTemplates.id });
			ensureWriteApplied(result, 'workout template', template.id);
		}
	}

	const replacementTemplateIds =
		payload.replaceWorkoutTemplateExercisesForTemplateIds?.map(
			(templateId) => idRemaps.workoutTemplates[templateId] ?? templateId
		) ?? [];

	if (replacementTemplateIds.length > 0) {
		await db
			.delete(s.workoutTemplateExercises)
			.where(
				and(
					eq(s.workoutTemplateExercises.userId, userId),
					inArray(s.workoutTemplateExercises.templateId, replacementTemplateIds)
				)
			);
	}

	if (payload.workoutTemplateExercises?.length) {
		for (const wte of payload.workoutTemplateExercises) {
			const remappedWte = {
				...wte,
				templateId: idRemaps.workoutTemplates[wte.templateId] ?? wte.templateId,
				exerciseId: idRemaps.exercises[wte.exerciseId] ?? wte.exerciseId
			};

			if (remappedWte.seedSlug) {
				await clearConflictingSeedSlug(
					s.workoutTemplateExercises,
					userId,
					remappedWte.id,
					remappedWte.seedSlug
				);
			}

			const result = await db
				.insert(s.workoutTemplateExercises)
				.values({ ...remappedWte, userId })
				.onConflictDoUpdate({
					target: s.workoutTemplateExercises.id,
					set: { ...remappedWte, userId },
					setWhere: eq(s.workoutTemplateExercises.userId, userId)
				})
				.returning({ id: s.workoutTemplateExercises.id });
			ensureWriteApplied(result, 'workout template exercise', wte.id);
		}
	}

	if (payload.workoutSessions?.length) {
		for (const session of payload.workoutSessions) {
			const remappedSession = {
				...session,
				templateId: session.templateId
					? (idRemaps.workoutTemplates[session.templateId] ?? session.templateId)
					: null
			};
			const result = await db
				.insert(s.workoutSessions)
				.values({ ...remappedSession, userId })
				.onConflictDoUpdate({
					target: s.workoutSessions.id,
					set: { ...remappedSession, userId },
					setWhere: eq(s.workoutSessions.userId, userId)
				})
				.returning({ id: s.workoutSessions.id });
			ensureWriteApplied(result, 'workout session', session.id);
		}
	}

	if (payload.loggedExercises?.length) {
		for (const loggedExercise of payload.loggedExercises) {
			const remappedLoggedExercise = {
				...loggedExercise,
				exerciseId: idRemaps.exercises[loggedExercise.exerciseId] ?? loggedExercise.exerciseId
			};
			const result = await db
				.insert(s.loggedExercises)
				.values({ ...remappedLoggedExercise, userId })
				.onConflictDoUpdate({
					target: s.loggedExercises.id,
					set: { ...remappedLoggedExercise, userId },
					setWhere: eq(s.loggedExercises.userId, userId)
				})
				.returning({ id: s.loggedExercises.id });
			ensureWriteApplied(result, 'logged exercise', loggedExercise.id);
		}
	}

	if (payload.loggedExerciseBands?.length) {
		for (const loggedExerciseBand of payload.loggedExerciseBands) {
			const remappedLoggedExerciseBand = {
				...loggedExerciseBand,
				bandId: idRemaps.bands[loggedExerciseBand.bandId] ?? loggedExerciseBand.bandId
			};
			const result = await db
				.insert(s.loggedExerciseBands)
				.values({ ...remappedLoggedExerciseBand, userId })
				.onConflictDoUpdate({
					target: s.loggedExerciseBands.id,
					set: { ...remappedLoggedExerciseBand, userId },
					setWhere: eq(s.loggedExerciseBands.userId, userId)
				})
				.returning({ id: s.loggedExerciseBands.id });
			ensureWriteApplied(result, 'logged exercise band', loggedExerciseBand.id);
		}
	}

	await dedupeServerTemplateExercisePairs(userId);

	return json({ syncedAt, idRemaps });
}

type SyncIdRemaps = {
	bands: Record<string, string>;
	exercises: Record<string, string>;
	workoutTemplates: Record<string, string>;
};
