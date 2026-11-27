/**
 * The Jest SQLite engine: a real, in-memory SQLite database (sql.js) with the
 * generated migrations applied, exposed through the same Drizzle query API as
 * expo-sqlite. Repositories take the driver-agnostic handle, so the exact
 * code runs against `expo-sqlite` in the app and sql.js under Jest.
 */
import { sql } from 'drizzle-orm';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import initSqlJs, { type Database } from 'sql.js';

import { MIGRATIONS } from '../migrations';
import * as schema from '../schema';

/** One generated migration: its id and its statements. */
export type GeneratedMigration = { id: string; sql: readonly string[] };

/**
 * The driver-agnostic SQLite handle both drivers satisfy: drizzle's base
 * class parameterized over either result kind and this app's schema.
 */
export type SqlDb = import('drizzle-orm/sqlite-core').BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

export type SqlJsFixture = {
  client: Database;
  db: SQLJsDatabase<typeof schema>;
};

/** How many of the generated migrations the database file has applied. */
export async function appliedMigrationCount(client: Database): Promise<number> {
  const result = client.exec('PRAGMA user_version');
  const value = result[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

/**
 * Applies the pending migrations (each in one transaction, guarded by the
 * database's `user_version`) and keeps the single-row sync_state cursor
 * present — the same algorithm src/data/db/client.ts runs on expo-sqlite.
 * Running it again on a migrated database is a no-op.
 */
export async function applyMigrationsSqlJs(client: Database, migrations: readonly GeneratedMigration[] = MIGRATIONS): Promise<void> {
  const applied = await appliedMigrationCount(client);
  client.run('PRAGMA foreign_keys = ON');
  const db = drizzle(client, { schema });
  for (const [offset, migration] of migrations.slice(applied).entries()) {
    // BEGIN … user_version … COMMIT (the header write is transactional), so
    // a failed migration leaves neither tables nor version behind. Raw
    // BEGIN/COMMIT rather than drizzle's transaction: the sql-js session
    // commits before an async body finishes.
    await db.run(sql.raw('BEGIN'));
    try {
      for (const statement of migration.sql) {
        await db.run(sql.raw(statement));
      }
      await db.run(sql.raw(`PRAGMA user_version = ${applied + offset + 1}`));
      await db.run(sql.raw('COMMIT'));
    } catch (error) {
      try {
        await db.run(sql.raw('ROLLBACK'));
      } catch {
        // Already rolled back or never opened.
      }
      throw error;
    }
  }
  await db.run(sql`INSERT OR IGNORE INTO sync_state (id, pull_cursor) VALUES (1, 0)`);
}

/** Fresh migrated database per call — the "new GRDB DB per test" convention. */
export async function createSqlJsDb(): Promise<SqlJsFixture> {
  const SQL = await initSqlJs();
  const client = new SQL.Database();
  await applyMigrationsSqlJs(client);
  const db = drizzle(client, { schema });
  return { client, db };
}

/**
 * Reopens a database from exported bytes (`Database.export()`): migrations
 * already applied (user_version travels in the file header) stay applied.
 * The twin of "committed writes survive pool close and reopen".
 */
export async function reopenSqlJsDb(bytes: Uint8Array): Promise<SqlJsFixture> {
  const SQL = await initSqlJs();
  const client = new SQL.Database(bytes);
  await applyMigrationsSqlJs(client);
  const db = drizzle(client, { schema });
  return { client, db };
}
