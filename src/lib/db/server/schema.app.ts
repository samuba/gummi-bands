// Server-side app schema - mirrors local schema with required userId for multi-tenancy
import { pgTable, text, integer, timestamp, real, boolean, index, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './schema.auth';
import { uuidv7 } from '../dbHelper';

// User reference column - required for all server tables
const userIdColumn = () => uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' });

export const bands = pgTable('app_bands', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	name: text().notNull(),
	resistance: real().notNull(),
	color: text(),
	seedSlug: text(),
	createdAt: timestamp({ withTimezone: true }).notNull(),
	updatedAt: timestamp({ withTimezone: true }).notNull(),
	deletedAt: timestamp({ withTimezone: true })
}, (table) => [
	index('app_bands_user_id_idx').on(table.userId),
	uniqueIndex('app_bands_user_id_seed_slug_unique_idx').on(table.userId, table.seedSlug)
]);

export const settings = pgTable('app_settings', {
	userId: userIdColumn().primaryKey(),
	weightUnit: text({ enum: ['lbs', 'kg'] }).notNull().default('lbs'),
	keepScreenAwake: boolean().notNull().default(true),
	updatedAt: timestamp({ withTimezone: true }).notNull()
}, (table) => [
	index('app_settings_user_id_idx').on(table.userId)
]);

export const exercises = pgTable('app_exercises', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	name: text().notNull(),
	seedSlug: text(),
	createdAt: timestamp({ withTimezone: true }).notNull(),
	updatedAt: timestamp({ withTimezone: true }).notNull(),
	deletedAt: timestamp({ withTimezone: true })
}, (table) => [
	index('app_exercises_user_id_idx').on(table.userId),
	uniqueIndex('app_exercises_user_id_seed_slug_unique_idx').on(table.userId, table.seedSlug)
]);

export const workoutTemplates = pgTable('app_workout_templates', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	name: text().notNull(),
	seedSlug: text(),
	createdAt: timestamp({ withTimezone: true }).notNull(),
	updatedAt: timestamp({ withTimezone: true }).notNull(),
	icon: text(),
	sortOrder: integer().notNull().default(0)
}, (table) => [
	index('app_workout_templates_user_id_idx').on(table.userId),
	uniqueIndex('app_workout_templates_user_id_seed_slug_unique_idx').on(table.userId, table.seedSlug)
]);

export const workoutTemplateExercises = pgTable('app_workout_template_exercises', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	templateId: uuidv7().notNull(),
	exerciseId: uuidv7().notNull(),
	seedSlug: text(),
	sortOrder: integer().notNull().default(0)
}, (table) => [
	index('app_workout_template_exercises_user_id_idx').on(table.userId),
	uniqueIndex('app_workout_template_exercises_user_id_seed_slug_unique_idx').on(table.userId, table.seedSlug)
]);

export const workoutSessions = pgTable('app_workout_sessions', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	templateId: uuidv7(),
	startedAt: timestamp({ withTimezone: true }).notNull(),
	updatedAt: timestamp({ withTimezone: true }).notNull(),
	endedAt: timestamp({ withTimezone: true }),
	notes: text(),
	plannedExercises: text().array().default(sql`'{}'::text[]`)
}, (table) => [
	index('app_workout_sessions_user_id_idx').on(table.userId)
]);

export const loggedExercises = pgTable('app_logged_exercises', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	sessionId: uuidv7().notNull(),
	exerciseId: uuidv7().notNull(),
	fullReps: integer().notNull().default(0),
	partialReps: integer().notNull().default(0),
	notes: text(),
	loggedAt: timestamp({ withTimezone: true }).notNull()
}, (table) => [
	index('app_logged_exercises_user_id_idx').on(table.userId)
]);

export const loggedExerciseBands = pgTable('app_logged_exercise_bands', {
	id: uuidv7().primaryKey(),
	userId: userIdColumn(),
	loggedExerciseId: uuidv7().notNull(),
	bandId: uuidv7().notNull()
}, (table) => [
	index('app_logged_exercise_bands_user_id_idx').on(table.userId)
]);

// Relations for server schema
export const serverBandsRelations = relations(bands, ({ one }) => ({
	user: one(user, { fields: [bands.userId], references: [user.id] })
}));

export const serverExercisesRelations = relations(exercises, ({ one }) => ({
	user: one(user, { fields: [exercises.userId], references: [user.id] })
}));

export const serverWorkoutTemplatesRelations = relations(workoutTemplates, ({ one }) => ({
	user: one(user, { fields: [workoutTemplates.userId], references: [user.id] })
}));

export const serverWorkoutTemplateExercisesRelations = relations(workoutTemplateExercises, ({ one }) => ({
	user: one(user, { fields: [workoutTemplateExercises.userId], references: [user.id] })
}));

export const serverWorkoutSessionsRelations = relations(workoutSessions, ({ one }) => ({
	user: one(user, { fields: [workoutSessions.userId], references: [user.id] })
}));

export const serverLoggedExercisesRelations = relations(loggedExercises, ({ one }) => ({
	user: one(user, { fields: [loggedExercises.userId], references: [user.id] })
}));

export const serverLoggedExerciseBandsRelations = relations(loggedExerciseBands, ({ one }) => ({
	user: one(user, { fields: [loggedExerciseBands.userId], references: [user.id] })
}));

export const serverSettingsRelations = relations(settings, ({ one }) => ({
	user: one(user, { fields: [settings.userId], references: [user.id] })
}));
