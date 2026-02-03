import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/lib/db/server/schema.ts",
	out: "./src/lib/db/server/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	casing: "snake_case",
});
