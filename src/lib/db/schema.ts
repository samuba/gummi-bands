import { pgTable, text, integer, uuid, timestamp, real } from 'drizzle-orm/pg-core';

// Rubber bands with resistance levels
export const bands = pgTable('bands', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	resistance: real('resistance').notNull(), // in lbs
	color: text('color'), // optional color for visual identification
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Exercise definitions
export const exercises = pgTable('exercises', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Workout session templates
export const workoutTemplates = pgTable('workout_templates', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Junction table for exercises in templates
export const workoutTemplateExercises = pgTable('workout_template_exercises', {
	id: uuid('id').primaryKey().defaultRandom(),
	templateId: uuid('template_id')
		.notNull()
		.references(() => workoutTemplates.id, { onDelete: 'cascade' }),
	exerciseId: uuid('exercise_id')
		.notNull()
		.references(() => exercises.id, { onDelete: 'cascade' }),
	sortOrder: integer('sort_order').notNull().default(0)
});

// Workout sessions
export const workoutSessions = pgTable('workout_sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	templateId: uuid('template_id').references(() => workoutTemplates.id),
	startedAt: timestamp('started_at').defaultNow().notNull(),
	endedAt: timestamp('ended_at'),
	notes: text('notes')
});

// Logged exercises within a workout session
export const loggedExercises = pgTable('logged_exercises', {
	id: uuid('id').primaryKey().defaultRandom(),
	sessionId: uuid('session_id')
		.notNull()
		.references(() => workoutSessions.id, { onDelete: 'cascade' }),
	exerciseId: uuid('exercise_id')
		.notNull()
		.references(() => exercises.id),
	fullReps: integer('full_reps').notNull().default(0),
	partialReps: integer('partial_reps').notNull().default(0),
	notes: text('notes'),
	loggedAt: timestamp('logged_at').defaultNow().notNull()
});

// Junction table for bands used in logged exercises
export const loggedExerciseBands = pgTable('logged_exercise_bands', {
	id: uuid('id').primaryKey().defaultRandom(),
	loggedExerciseId: uuid('logged_exercise_id')
		.notNull()
		.references(() => loggedExercises.id, { onDelete: 'cascade' }),
	bandId: uuid('band_id')
		.notNull()
		.references(() => bands.id)
});

// Type exports
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

