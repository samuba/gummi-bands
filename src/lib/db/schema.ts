import { pgTable, text, integer, uuid, timestamp, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// uses drizzle auto snake_case conversion for column names 

export const bands = pgTable('bands', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull(),
	resistance: real().notNull(), // in lbs
	color: text(), // optional color for visual identification
	createdAt: timestamp().defaultNow().notNull()
});

export const exercises = pgTable('exercises', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull(),
	createdAt: timestamp().defaultNow().notNull()
});

export const workoutTemplates = pgTable('workout_templates', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull(),
	createdAt: timestamp().defaultNow().notNull(),
	icon: text(),
});

// Junction table for exercises in templates
export const workoutTemplateExercises = pgTable('workout_template_exercises', {
	id: uuid().primaryKey().defaultRandom(),
	templateId: uuid().notNull().references(() => workoutTemplates.id, { onDelete: 'cascade' }),
	exerciseId: uuid().notNull().references(() => exercises.id, { onDelete: 'cascade' }),
	sortOrder: integer().notNull().default(0)
});

export const workoutSessions = pgTable('workout_sessions', {
	id: uuid().primaryKey().defaultRandom(),
	templateId: uuid().references(() => workoutTemplates.id),
	startedAt: timestamp().defaultNow().notNull(),
	endedAt: timestamp(),
	notes: text()
});

// Logged exercises within a workout session
export const loggedExercises = pgTable('logged_exercises', {
	id: uuid().primaryKey().defaultRandom(),
	sessionId: uuid().notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
	exerciseId: uuid().notNull().references(() => exercises.id),
	fullReps: integer().notNull().default(0),
	partialReps: integer().notNull().default(0),
	notes: text(),
	loggedAt: timestamp().defaultNow().notNull()
});

// Junction table for bands used in logged exercises
export const loggedExerciseBands = pgTable('logged_exercise_bands', {
	id: uuid().primaryKey().defaultRandom(),
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

