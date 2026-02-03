import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "$lib/db/server";
import * as schema from "$lib/db/server/schema";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "$env/static/private";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";

export const auth = betterAuth({
	database: drizzleAdapter(db, { 
		provider: "pg",
		schema,
	}),
	emailAndPassword: { enabled: true },
	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
		},
	},
	advanced: {
		database: {
			generateId: false, // we use uuidv7 in the schema
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)],
});
