import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

// example table
export const user = pgTable('user', {
	id: uuid('id').primaryKey(),
	age: integer('age')
});
