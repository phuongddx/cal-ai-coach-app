/**
 * The local SQLite database (spec D4: "expo-sqlite + Drizzle, WAL").
 * Opens `coachcal.db`, enables WAL, applies the bundled migrations.
 * Called by `getSyncRuntime()`; no native calls at module import time.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';
import migrations from './migrations';

export type LocalDb = {
  sqlite: SQLiteDatabase;
  db: ExpoSQLiteDatabase<typeof schema>;
};

export async function openLocalDb(fileName = 'coachcal.db'): Promise<LocalDb> {
  const sqlite = openDatabaseSync(fileName);
  sqlite.execSync('PRAGMA journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  return { sqlite, db };
}
