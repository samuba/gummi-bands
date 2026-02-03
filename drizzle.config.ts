import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/app/schema.ts',
	dialect: 'postgresql',
	out: './src/lib/db/app/migrations',
	// dbCredentials: { url: process.env.DATABASE_URL },
	casing: 'snake_case',
	verbose: true,
	strict: true
});
