import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { openNodeSqliteTestDb } from '../testing/nodeSqlite';
// The exact committed bundled migration artifact the app ships with.
import { migrationsBundle } from '../migrations';

/**
 * Plan 01-02 Task 2 bootstrap proof: a clean isolated SQLite database applies
 * the bundled journal and creates the three foundation tables; running the
 * same artifact a second time retains the journal without duplicating state.
 */

const FOUNDATION_TABLES = ['diary_entries', 'pending_ops', 'sync_state'] as const;

function tableNames(db: ExpoSQLiteDatabase): string[] {
  const rows = db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  );
  return rows.map((row) => row.name);
}

describe('bundled migration bootstrap', () => {
  it('applies the journal to a clean database and creates all foundation tables', async () => {
    const client = openNodeSqliteTestDb();
    const db = drizzle(client as never);

    await migrate(db, migrationsBundle);

    for (const table of FOUNDATION_TABLES) {
      expect(tableNames(db)).toContain(table);
    }
    client.closeSync();
  });

  it('is idempotent — a second application retains the journal without duplicates', async () => {
    const client = openNodeSqliteTestDb();
    const db = drizzle(client as never);

    await migrate(db, migrationsBundle);
    const tablesAfterFirst = tableNames(db);
    const journalRowsAfterFirst = db.all<{ id: number }>(
      'SELECT id FROM __drizzle_migrations'
    );

    await expect(migrate(db, migrationsBundle)).resolves.toBeUndefined();

    expect(tableNames(db)).toStrictEqual(tablesAfterFirst);
    const journalRowsAfterSecond = db.all<{ id: number }>(
      'SELECT id FROM __drizzle_migrations'
    );
    expect(journalRowsAfterSecond).toHaveLength(journalRowsAfterFirst.length);

    client.closeSync();
  });
});
