// uses drizzle auto snake_case conversion for column names 
import { pgTable, text, integer, uuid, timestamp, real, boolean } from 'drizzle-orm/pg-core';
import { relations,sql } from 'drizzle-orm';

const uuidv7 = () => uuid().default(sql`uuid_generate_v7()`);

export const bands = pgTable('bands', {
	id: uuidv7().primaryKey(),
	name: text().notNull(),
	resistance: real().notNull(), // in lbs
	color: text(), // optional color for visual identification
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => sql`now()`),
	deletedAt: timestamp({ withTimezone: true })
});

export const settings = pgTable('settings', {
	id: text().primaryKey(), // We'll use a fixed ID like 'global'
	weightUnit: text({ enum: ['lbs', 'kg'] }).notNull().default('lbs'),
	keepScreenAwake: boolean().notNull().default(true),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => sql`now()`)
});

export const exercises = pgTable('exercises', {
	id: uuidv7().primaryKey(),
	name: text().notNull(),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => sql`now()`),
	deletedAt: timestamp({ withTimezone: true })
});

export const workoutTemplates = pgTable('workout_templates', {
	id: uuidv7().primaryKey(),
	name: text().notNull(),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => sql`now()`),
	icon: text(),
	sortOrder: integer().notNull().default(0)
});

// Junction table for exercises in templates
export const workoutTemplateExercises = pgTable('workout_template_exercises', {
	id: uuidv7().primaryKey(),
	templateId: uuid().notNull().references(() => workoutTemplates.id, { onDelete: 'cascade' }),
	exerciseId: uuid().notNull().references(() => exercises.id, { onDelete: 'cascade' }),
	sortOrder: integer().notNull().default(0)
});

export const workoutSessions = pgTable('workout_sessions', {
	id: uuidv7().primaryKey(),
	templateId: uuid().references(() => workoutTemplates.id),
	startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => sql`now()`),
	endedAt: timestamp({ withTimezone: true }),
	notes: text(),
	plannedExercises: text().array().default(sql`'{}'::text[]`)
});

// Logged exercises within a workout session
export const loggedExercises = pgTable('logged_exercises', {
	id: uuidv7().primaryKey(),
	sessionId: uuid().notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
	exerciseId: uuid().notNull().references(() => exercises.id),
	fullReps: integer().notNull().default(0),
	partialReps: integer().notNull().default(0),
	notes: text(),
	loggedAt: timestamp({ withTimezone: true }).defaultNow().notNull()
});

// Junction table for bands used in logged exercises
export const loggedExerciseBands = pgTable('logged_exercise_bands', {
	id: uuidv7().primaryKey(),
	loggedExerciseId: uuid().notNull().references(() => loggedExercises.id, { onDelete: 'cascade' }),
	bandId: uuid().notNull().references(() => bands.id)
});

// Relations
export const bandsRelations = relations(bands, ({ many }) => ({
	loggedExerciseBands: many(loggedExerciseBands)
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
	workoutTemplateExercises: many(workoutTemplateExercises),
	loggedExercises: many(loggedExercises)
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ many }) => ({
	workoutTemplateExercises: many(workoutTemplateExercises),
	workoutSessions: many(workoutSessions)
}));

export const workoutTemplateExercisesRelations = relations(workoutTemplateExercises, ({ one }) => ({
	template: one(workoutTemplates, {
		fields: [workoutTemplateExercises.templateId],
		references: [workoutTemplates.id]
	}),
	exercise: one(exercises, {
		fields: [workoutTemplateExercises.exerciseId],
		references: [exercises.id]
	})
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
	template: one(workoutTemplates, {
		fields: [workoutSessions.templateId],
		references: [workoutTemplates.id]
	}),
	loggedExercises: many(loggedExercises)
}));

export const loggedExercisesRelations = relations(loggedExercises, ({ one, many }) => ({
	session: one(workoutSessions, {
		fields: [loggedExercises.sessionId],
		references: [workoutSessions.id]
	}),
	exercise: one(exercises, {
		fields: [loggedExercises.exerciseId],
		references: [exercises.id]
	}),
	loggedExerciseBands: many(loggedExerciseBands)
}));

export const loggedExerciseBandsRelations = relations(loggedExerciseBands, ({ one }) => ({
	loggedExercise: one(loggedExercises, {
		fields: [loggedExerciseBands.loggedExerciseId],
		references: [loggedExercises.id]
	}),
	band: one(bands, {
		fields: [loggedExerciseBands.bandId],
		references: [bands.id]
	})
}));

export type Band = typeof bands.$inferSelect;
export type NewBand = typeof bands.$inferInsert;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;

export type LoggedExercise = typeof loggedExercises.$inferSelect;
export type NewLoggedExercise = typeof loggedExercises.$inferInsert;

export type LoggedExerciseBand = typeof loggedExerciseBands.$inferSelect;
export type NewLoggedExerciseBand = typeof loggedExerciseBands.$inferInsert;

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;

export type WorkoutTemplateExercise = typeof workoutTemplateExercises.$inferSelect;
export type NewWorkoutTemplateExercise = typeof workoutTemplateExercises.$inferInsert;
