/**
 * The local SQLite database (spec D4: "expo-sqlite + Drizzle, WAL").
 * Opens `coachcal.db`, enables WAL and foreign keys, applies the generated
 * migrations (src/data/db/migrations.ts) in order — each in one transaction,
 * guarded by the database's `user_version` — seeds the single-row
 * `sync_state` cursor and exposes the Drizzle instance.
 * Called by `getSyncRuntime()`; no native calls at module import time.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';
import { MIGRATIONS } from './migrations';

export type LocalDb = {
  sqlite: SQLiteDatabase;
  db: ExpoSQLiteDatabase<typeof schema>;
};

export async function openLocalDb(fileName = 'coachcal.db'): Promise<LocalDb> {
  const sqlite = openDatabaseSync(fileName);
  sqlite.execSync('PRAGMA journal_mode = WAL');
  // Both drivers default to foreign_keys = off; the schema carries the
  // Swift constraints, so turn enforcement on (mirrors testing/sqlJsDb.ts).
  sqlite.execSync('PRAGMA foreign_keys = ON');

  const applied = readAppliedMigrations(sqlite);
  for (const [offset, migration] of MIGRATIONS.slice(applied).entries()) {
    sqlite.execSync('BEGIN');
    try {
      for (const statement of migration.sql) {
        sqlite.execSync(statement);
      }
      sqlite.execSync(`PRAGMA user_version = ${applied + offset + 1}`);
      sqlite.execSync('COMMIT');
    } catch (error) {
      sqlite.execSync('ROLLBACK');
      throw error;
    }
  }
  // GRDB's "1__foundation_sync" seeds the single-row cursor; the generated
  // schema cannot, so the client keeps the row present (idempotent).
  sqlite.execSync('INSERT OR IGNORE INTO sync_state (id, pull_cursor) VALUES (1, 0)');

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

function readAppliedMigrations(sqlite: SQLiteDatabase): number {
  const row = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}
