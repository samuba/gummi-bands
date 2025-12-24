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

// Workout sessions
export const workoutSessions = pgTable('workout_sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
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

