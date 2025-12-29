import { browser } from '$app/environment';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { type Results, PGlite } from '@electric-sql/pglite';
import { type LiveNamespace, live } from '@electric-sql/pglite/live';
import { migrate } from './migrate';
import { seedData } from './seed';

let pglite: PGlite & { live: LiveNamespace };
let initPromise: Promise<void> | null = null;

export let db: PgliteDatabase<typeof schema> & { $client: PGlite };

export type Db = typeof db;

export async function initDatabase() {
	if (!browser) return;
	
	if (initPromise) return initPromise;

	initPromise = (async () => {
		pglite = await PGlite.create("idb://gummi-bands-db", {
			extensions: { live, }
		});
		db = drizzle(pglite, { schema, casing: 'snake_case' });

		await migrate(db);
		await seedData(db);
	})();
	
	return initPromise;
}

/// Run drizzle queries as live queries. 
/// Returns a promise that resolves when the query completes for the first time 
/// and will run the callback every time the result changes .
/// @param query - The drizzle query to run.
/// @param callback - The callback to run when the query result changes or the query completes for the first time.
export async function liveQuery<Q extends { toSQL(): { sql: string; params: unknown[] } } & PromiseLike<unknown[]>>(
	query: Q,
	callback: (rows: Awaited<Q>[number][]) => void
): Promise<Awaited<Q>[number][]> {
	return new Promise((resolve) => {
		let resolved = false;
		const { sql, params } = query.toSQL();
		pglite.live.query(sql, params,
			(res: Results<Awaited<Q>[number]>) => {
				callback(res.rows);
				if (!resolved) {
					resolved = true;
					resolve(res.rows);
				}
			}
		);
	});
}
