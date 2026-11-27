/**
 * Jest twin of native/App/CoachCalTests/AppLaunchMigrationTests.swift —
 * "launch bootstraps a migrated database". The Swift test opens the shared
 * PersistenceBootstrap database and asserts the foundation migration ran
 * (one grdb_migrations row) and diary_entries answers a count. Here the
 * bootstrap is the generated migrations applied by user_version, exercised
 * on the sql.js engine (the expo-sqlite client runs the same algorithm in
 * src/data/db/client.ts).
 */
import { sql } from 'drizzle-orm';

import { MIGRATIONS } from './migrations';
import { appliedMigrationCount, createSqlJsDb, reopenSqlJsDb } from './testing/sqlJsDb';

describe('AppLaunchMigrationTests twin', () => {
  it('launch bootstraps a migrated database', async () => {
    const fixture = await createSqlJsDb();

    const migrated = await appliedMigrationCount(fixture.client);
    expect(migrated).toBe(MIGRATIONS.length);

    const diaryRows = await fixture.db.all<{ count: number }>(sql`SELECT COUNT(*) AS count FROM diary_entries`);
    expect(Number(diaryRows[0]?.count ?? 0)).toBe(0);

    // Re-opening the same database (close + reopen) applies nothing again.
    const reopened = await reopenSqlJsDb(fixture.client.export());
    expect(await appliedMigrationCount(reopened.client)).toBe(MIGRATIONS.length);
    const reopenedRows = await reopened.db.all<{ count: number }>(sql`SELECT COUNT(*) AS count FROM diary_entries`);
    expect(Number(reopenedRows[0]?.count ?? 0)).toBe(0);
  });
});
