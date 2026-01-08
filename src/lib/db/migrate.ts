import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";
import type { PgDialect, PgSession } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// cache the migration status for the current session
let migrated = false;

/**
 * Migrate the database inside the browser.
 * You should try to migrate before the first query on the database. 
 * You can opt to use top level await, but browser support is more limited (also needs vite build config edit).
 * We cache the migration status for the current session.
 * Migrator is based on the internal migrator
 * @see https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/pglite/migrator.ts
 * @see https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/migrator.ts#L48
 */
export async function migrate(database: PgliteDatabase<typeof schema>, extensionsToCreate: string[]) {
  if (migrated) return;

  for (const extension of extensionsToCreate) {
    await database.execute(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
  }

  const files = import.meta.glob<boolean, string, string>(
    // path should correspond to drizzle.config.ts, we cannot use public folder with dynamic imports
    "./migrations/*.sql",
    { query: "?raw", import: "default" }
  );

  // this path should also correspond to drizzle.config.ts
  const journal = await import("./migrations/meta/_journal.json");

  const migrations = [];

  for (const entry of journal.entries) {
    try {
      // ... and this path
      const migration = await files[`./migrations/${entry.tag}.sql`]!();
      const statements = migration.split("--> statement-breakpoint");

      migrations.push({
        sql: statements,
        bps: entry.breakpoints,
        folderMillis: entry.when,
        hash: await hash(migration),
      });
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to load migration ${entry.tag} from journal.`);
    }
  }

  // PgDialect and PgSession are marked as internal with stripInternal so we patch it
  const db = database as PgliteDatabase<typeof schema> & {
    dialect: PgDialect;
    session: PgSession;
  };

  console.log("running migrations", migrations);
  await db.dialect.migrate(migrations, db.session, "");
  migrated = true;
}

async function hash(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}