/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/MigrationTests.swift —
 * one case per Swift test, same behavior sentence. The Swift migrator's
 * registry (grdb_migrations) is the generated bundle's `user_version` here;
 * the schema assertions read sqlite_master / pragma table_info as the brief
 * requires.
 */
import { eq } from 'drizzle-orm';

import { diaryEntries } from './schema';
import { MIGRATIONS } from './migrations';
import { appliedMigrationCount, applyMigrationsSqlJs, createSqlJsDb } from './testing/sqlJsDb';
import { columnNames, createRepoFixture } from '../repos/testing/fixtures';
import { rowToEntry } from '../repos/diaryEntryRepository';

describe('MigrationTests twins', () => {
  it('foundation sync creates the exact tables and columns', async () => {
    const fixture = await createRepoFixture();

    const diaryColumns = columnNames(fixture.client, 'diary_entries');
    const pendingColumns = columnNames(fixture.client, 'pending_ops');
    const stateColumns = columnNames(fixture.client, 'sync_state');
    expect(diaryColumns).toEqual([
      'id', 'user_id', 'display_text', 'created_at', 'updated_at',
      'deleted_at', 'server_version', 'accepted_op_id', 'server_updated_at',
    ]);
    expect(pendingColumns).toEqual([
      'op_id', 'table_name', 'record_id', 'kind', 'snapshot',
      'client_timestamp', 'created_at', 'dispatch_attempts', 'next_retry_at',
      'quarantined',
    ]);
    expect(stateColumns).toEqual(['id', 'pull_cursor']);
    expect(fixture.db).toBeDefined();
  });

  it('foundation sync is idempotent', async () => {
    const fixture = await createRepoFixture();

    // The device client and the test fixture guard each migration with
    // `user_version`; re-running the whole set on a migrated database must
    // apply nothing again (the Swift registry keeps exactly one row).
    await applyMigrationsSqlJs(fixture.client, MIGRATIONS);
    await applyMigrationsSqlJs(fixture.client, MIGRATIONS);

    expect(await appliedMigrationCount(fixture.client)).toBe(MIGRATIONS.length);
    const diaryColumns = columnNames(fixture.client, 'diary_entries');
    expect(diaryColumns).toEqual([
      'id', 'user_id', 'display_text', 'created_at', 'updated_at',
      'deleted_at', 'server_version', 'accepted_op_id', 'server_updated_at',
    ]);
  });

  it('diary entry round trips a snapshot-shaped payload', async () => {
    const fixture = await createRepoFixture();
    const createdAt = new Date(1_768_300_000_000);
    const entry = {
      id: 'b07537f5-5709-45fa-b4c6-20cb5f0f1a1f',
      userId: '04bbb783-bbe3-4a11-be45-6b77e3d23b20',
      displayText: 'Oatmeal',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      serverVersion: 7,
      acceptedOpId: '2a5ef92b-018d-4ae9-b6d7-a2c39d36552c',
      serverUpdatedAt: createdAt,
    };

    await fixture.db.insert(diaryEntries).values({
      id: entry.id,
      userId: entry.userId,
      displayText: entry.displayText,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      deletedAt: null,
      serverVersion: entry.serverVersion,
      acceptedOpId: entry.acceptedOpId,
      serverUpdatedAt: createdAt.toISOString(),
    });
    const rows = await fixture.db.select().from(diaryEntries).where(eq(diaryEntries.id, entry.id));
    const stored = rowToEntry(rows[0]!);

    expect(stored).toEqual(entry);
  });
});
