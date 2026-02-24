import { and, eq } from "drizzle-orm";
import * as s from './schema';
import type { Db } from "./client";

/** IMPORTANT
 * Always use single inserts instead of bulk inserts to avoid having them all have same createdAt timestamp
 */

const seededBands: SeededBand[] = [
	// X3
	{ seedSlug: 'x3-white-2x', name: 'White 2x', resistance: 100, color: '#FFFFFF' },
	// { seedSlug: 'x3-light-grey', name: 'Light Grey', resistance: 80, color: '#D3D3D3' },
	// { seedSlug: 'x3-light-grey-2x', name: 'Light Grey 2x', resistance: 160, color: '#D3D3D3' },
	// { seedSlug: 'x3-dark-grey', name: 'Dark Grey', resistance: 120, color: '#808080' },
	// { seedSlug: 'x3-dark-grey-2x', name: 'Dark Grey 2x', resistance: 240, color: '#808080' },
	// { seedSlug: 'x3-black', name: 'Black', resistance: 150, color: '#000000' },
	// { seedSlug: 'x3-black-2x', name: 'Black 2x', resistance: 300, color: '#000000' },
	// { seedSlug: 'x3-elite', name: 'Elite', resistance: 300, color: '#FF8C00' },
	// { seedSlug: 'x3-elite-2x', name: 'Elite 2x', resistance: 600, color: '#FF8C00' },

	// Decathlon
	{ seedSlug: 'dec-orange-light', name: 'Orange Light', resistance: 77, color: '#FF8C00' },
	{ seedSlug: 'dec-orange-light-2x', name: 'Orange Light 2x', resistance: 154, color: '#FF8C00' },
	{ seedSlug: 'dec-red', name: 'Red', resistance: 99, color: '#FF0000' },
	{ seedSlug: 'dec-red-2x', name: 'Red 2x', resistance: 198, color: '#FF0000' },
	{ seedSlug: 'dec-black', name: 'Black', resistance: 132, color: '#000000' },
	{ seedSlug: 'dec-black-2x', name: 'Black 2x', resistance: 264, color: '#000000' },

	// Strength Shop
	{ seedSlug: 'dec-orange-heavy-strength-shop', name: 'Orange Heavy', resistance: 174, color: '#CC6600' },
	{ seedSlug: 'dec-orange-heavy-2x-strength-shop', name: 'Orange Heavy 2x', resistance: 348, color: '#CC6600' }
];

const seededExercises: SeededExercise[] = [
	{ seedSlug: 'chest-press', name: 'Chest Press' },
	{ seedSlug: 'chest-press-pec-crossover', name: 'Chest Press (Pec Crossover)' },
	{ seedSlug: 'overhead-press', name: 'Overhead Press' },
	{ seedSlug: 'tricep-press', name: 'Tricep Press' },
	{ seedSlug: 'squat-front', name: 'Squat (Front)' },
	{ seedSlug: 'deadlift', name: 'Deadlift' },
	{ seedSlug: 'bicep-curl', name: 'Bicep Curl' },
	{ seedSlug: 'row-bent', name: 'Row (Bent)' },
	{ seedSlug: 'calf-raise', name: 'Calf Raise' }
];

const seededTemplates: SeededTemplate[] = [
	{
		seedSlug: 'template-push-day',
		name: 'Push Day',
		exerciseSlugs: [
			'chest-press',
			'chest-press-pec-crossover',
			'overhead-press',
			'tricep-press',
			'squat-front'
		]
	},
	{
		seedSlug: 'template-pull-day',
		name: 'Pull Day',
		exerciseSlugs: [
			'deadlift',
			'bicep-curl',
			'row-bent',
			'calf-raise'
		]
	}
];

const seededTemplateExerciseSlug = (templateSlug: string, exerciseSlug: string) => `${templateSlug}-${exerciseSlug}`;

export async function seedData(db: Db) {
	if (!db) return;
	const start = performance.now();

	// Seed default bands by seedSlug so IDs can be generated locally.
	for (const seededBand of seededBands) {
		const existingBySlug = await db.query.bands.findFirst({
			where: eq(s.bands.seedSlug, seededBand.seedSlug),
			columns: { id: true }
		});
		if (existingBySlug) continue;

		const existingByAttributes = await db.query.bands.findFirst({
			where: and(
				eq(s.bands.name, seededBand.name),
				eq(s.bands.resistance, seededBand.resistance),
				eq(s.bands.color, seededBand.color)
			),
			columns: { id: true }
		});
		if (existingByAttributes) {
			await db
				.update(s.bands)
				.set({ seedSlug: seededBand.seedSlug })
				.where(eq(s.bands.id, existingByAttributes.id));
			continue;
		}

		await db.insert(s.bands).values({
			seedSlug: seededBand.seedSlug,
			name: seededBand.name,
			resistance: seededBand.resistance,
			color: seededBand.color
		});
	}

	// Seed exercises by seedSlug so IDs can be generated locally.
	for (const seededExercise of seededExercises) {
		const existingBySlug = await db.query.exercises.findFirst({
			where: eq(s.exercises.seedSlug, seededExercise.seedSlug),
			columns: { id: true }
		});
		if (existingBySlug) continue;

		const existingByName = await db.query.exercises.findFirst({
			where: eq(s.exercises.name, seededExercise.name),
			columns: { id: true }
		});
		if (existingByName) {
			await db
				.update(s.exercises)
				.set({ seedSlug: seededExercise.seedSlug })
				.where(eq(s.exercises.id, existingByName.id));
			continue;
		}

		await db.insert(s.exercises).values({
			seedSlug: seededExercise.seedSlug,
			name: seededExercise.name
		});
	}

	// Seed default workout templates and their exercises by seedSlug.
	for (const seededTemplate of seededTemplates) {
		const existingTemplateBySlug = await db.query.workoutTemplates.findFirst({
			where: eq(s.workoutTemplates.seedSlug, seededTemplate.seedSlug),
			columns: { id: true }
		});
		const existingTemplateByName = existingTemplateBySlug
			? null
			: await db.query.workoutTemplates.findFirst({
				where: eq(s.workoutTemplates.name, seededTemplate.name),
				columns: { id: true }
			});

		let templateId = existingTemplateBySlug?.id ?? existingTemplateByName?.id;
		if (!templateId) {
			const [insertedTemplate] = await db
				.insert(s.workoutTemplates)
				.values({
					seedSlug: seededTemplate.seedSlug,
					name: seededTemplate.name
				})
				.returning({ id: s.workoutTemplates.id });
			templateId = insertedTemplate.id;
		}
		if (existingTemplateByName) {
			await db
				.update(s.workoutTemplates)
				.set({ seedSlug: seededTemplate.seedSlug })
				.where(eq(s.workoutTemplates.id, existingTemplateByName.id));
		}

		for (let i = 0; i < seededTemplate.exerciseSlugs.length; i++) {
			const seededExerciseSlug = seededTemplate.exerciseSlugs[i];
			const seededExercise = seededExercises.find((exercise) => exercise.seedSlug === seededExerciseSlug);
			if (!seededExercise) continue;

			const exerciseBySlug = await db.query.exercises.findFirst({
				where: eq(s.exercises.seedSlug, seededExercise.seedSlug),
				columns: { id: true }
			});
			const exerciseByName = exerciseBySlug
				? null
				: await db.query.exercises.findFirst({
					where: eq(s.exercises.name, seededExercise.name),
					columns: { id: true }
				});
			let exerciseId = exerciseBySlug?.id ?? exerciseByName?.id;
			if (!exerciseId) {
				const [insertedExercise] = await db
					.insert(s.exercises)
					.values({
						seedSlug: seededExercise.seedSlug,
						name: seededExercise.name
					})
					.returning({ id: s.exercises.id });
				exerciseId = insertedExercise.id;
			}

			if (exerciseByName && !exerciseBySlug) {
				await db
					.update(s.exercises)
					.set({ seedSlug: seededExercise.seedSlug })
					.where(eq(s.exercises.id, exerciseByName.id));
			}

			const templateExerciseSlug = seededTemplateExerciseSlug(
				seededTemplate.seedSlug,
				seededExercise.seedSlug
			);
			const linkBySlug = await db.query.workoutTemplateExercises.findFirst({
				where: eq(s.workoutTemplateExercises.seedSlug, templateExerciseSlug),
				columns: { id: true }
			});
			if (linkBySlug) continue;

			const linkByPair = await db.query.workoutTemplateExercises.findFirst({
				where: and(
					eq(s.workoutTemplateExercises.templateId, templateId),
					eq(s.workoutTemplateExercises.exerciseId, exerciseId)
				),
				columns: { id: true }
			});
			if (linkByPair) {
				await db
					.update(s.workoutTemplateExercises)
					.set({ seedSlug: templateExerciseSlug })
					.where(eq(s.workoutTemplateExercises.id, linkByPair.id));
				continue;
			}

			await db.insert(s.workoutTemplateExercises).values({
				templateId,
				exerciseId,
				seedSlug: templateExerciseSlug,
				sortOrder: i
			});
		}
	}
	const end = performance.now();
	console.log(`Seed data took ${end - start}ms`);
}

type SeededBand = {
	seedSlug: string;
	name: string;
	resistance: number;
	color: string;
};

type SeededExercise = {
	seedSlug: string;
	name: string;
};

type SeededTemplate = {
	seedSlug: string;
	name: string;
	exerciseSlugs: string[];
};
