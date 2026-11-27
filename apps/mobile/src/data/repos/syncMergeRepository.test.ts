/**
 * The sync merge repository behaviors (parity DB-03): last-writer-wins
 * through `compareCanonicalVersions`, the pending-local-intent skip, the
 * cursor kept in `sync_state`, and the acknowledgement version bump. The
 * Swift package itself tests these through CoachCalSync's dispatch tests
 * (another unit); these cases pin the port directly.
 */
import type { PullResponse, PushAcknowledgement } from '@coachcal/core';

import { pendingOps as pendingOpsTable } from '../db/schema';
import { createSyncMergeRepository, enqueueDiaryOp } from './syncMergeRepository';
import { insertPendingOp, fetchDiaryEntry, upsertDiaryEntry, type DiaryEntry } from './diaryEntryRepository';
import { inTransaction } from './sqlDb';
import { createRepoFixture, FIXED_NOW_MS } from './testing/fixtures';

const OWNER_ID = 'de000000-0000-4000-8000-000000000001';
const RECORD_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001';

function snapshot(at: { displayText: string; deletedAt?: string | null; serverVersion: number; acceptedOpId: string | null }) {
  return {
    id: RECORD_ID,
    displayText: at.displayText,
    deletedAt: at.deletedAt ?? null,
    serverVersion: at.serverVersion,
    acceptedOpId: at.acceptedOpId,
  };
}

function pulledRow(snapshotShape: ReturnType<typeof snapshot>): PullResponse['rows'][number] {
  return { table: 'diary_entries', recordId: RECORD_ID, snapshot: snapshotShape };
}

async function seedLocalRow(fixture: Awaited<ReturnType<typeof createRepoFixture>>, entry: Partial<DiaryEntry>): Promise<DiaryEntry> {
  const now = new Date(FIXED_NOW_MS);
  const row: DiaryEntry = {
    id: RECORD_ID,
    userId: OWNER_ID,
    displayText: 'Local title',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    serverVersion: 1,
    acceptedOpId: 'aaaaaaaa-0000-4000-8000-000000000001',
    serverUpdatedAt: now,
    ...entry,
  };
  await inTransaction(fixture.db, async (tx) => {
    await upsertDiaryEntry(tx, row);
  });
  return row;
}

describe('sync merge repository', () => {
  it('a newer pulled row overwrites the mirror and advances the cursor', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });
    await seedLocalRow(fixture, { serverVersion: 1, acceptedOpId: 'aaaaaaaa-0000-4000-8000-000000000001' });

    const outcome = await repository.apply(
      [],
      { rows: [pulledRow(snapshot({ displayText: 'Server title', serverVersion: 2, acceptedOpId: 'bbbbbbbb-0000-4000-8000-000000000002' }))], cursor: 5 },
      OWNER_ID,
      { now: new Date(FIXED_NOW_MS + 1000) },
    );

    expect(outcome).toEqual({ appliedRowCount: 1, cursor: 5 });
    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.displayText).toBe('Server title');
    expect(stored?.serverVersion).toBe(2);
    expect(await repository.readCursor()).toBe(5);
  });

  it('an older or equal pulled row loses and the cursor still advances', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });
    await seedLocalRow(fixture, { serverVersion: 3, acceptedOpId: 'cccccccc-0000-4000-8000-000000000003' });

    const outcome = await repository.apply(
      [],
      { rows: [pulledRow(snapshot({ displayText: 'Old server title', serverVersion: 2, acceptedOpId: 'dddddddd-0000-4000-8000-000000000004' }))], cursor: 9 },
      OWNER_ID,
      { now: new Date(FIXED_NOW_MS + 1000) },
    );

    expect(outcome.appliedRowCount).toBe(0);
    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.displayText).toBe('Local title');
    expect(await repository.readCursor()).toBe(9);
  });

  it('a pulled row with a pending local op is skipped', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });
    await seedLocalRow(fixture, { serverVersion: 1, acceptedOpId: null });
    await enqueueDiaryOp(fixture.db, {
      opId: 'eeeeeeee-0000-4000-8000-000000000005',
      recordId: RECORD_ID,
      kind: 'upsert',
      clientTimestamp: new Date(FIXED_NOW_MS + 500),
      createdAt: new Date(FIXED_NOW_MS + 500),
      entry: (await fetchDiaryEntry(fixture.db, RECORD_ID))!,
    });

    const outcome = await repository.apply(
      [],
      { rows: [pulledRow(snapshot({ displayText: 'Server title', serverVersion: 9, acceptedOpId: 'bbbbbbbb-0000-4000-8000-000000000002' }))], cursor: 3 },
      OWNER_ID,
      { now: new Date(FIXED_NOW_MS + 1000) },
    );

    expect(outcome.appliedRowCount).toBe(0);
    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.displayText).toBe('Local title');
    expect(await repository.readCursor()).toBe(3);
  });

  it('a new pulled record inserts with the owner id', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });

    const outcome = await repository.apply(
      [],
      { rows: [pulledRow(snapshot({ displayText: 'From the server', serverVersion: 4, acceptedOpId: 'bbbbbbbb-0000-4000-8000-000000000002' }))], cursor: 2 },
      OWNER_ID,
      { now: new Date(FIXED_NOW_MS + 1000) },
    );

    expect(outcome.appliedRowCount).toBe(1);
    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.userId).toBe(OWNER_ID);
    expect(stored?.displayText).toBe('From the server');
    expect(stored?.serverVersion).toBe(4);
  });

  it('an acknowledgement stamps the newer version and deletes the op', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });
    const local = await seedLocalRow(fixture, { serverVersion: 1, acceptedOpId: null });
    const opId = 'eeeeeeee-0000-4000-8000-000000000005';
    await insertPendingOp(fixture.db, {
      opId,
      tableName: 'diary_entries',
      recordId: RECORD_ID,
      kind: 'upsert',
      snapshot: '{}',
      clientTimestamp: new Date(FIXED_NOW_MS),
      createdAt: new Date(FIXED_NOW_MS),
      dispatchAttempts: 0,
      nextRetryAt: null,
      quarantined: false,
    });

    const acknowledgement: PushAcknowledgement = {
      opId,
      serverVersion: 7,
      acceptedOpId: 'bbbbbbbb-0000-4000-8000-000000000002',
      duplicate: false,
    };
    const outcome = await repository.apply([acknowledgement], { rows: [], cursor: 0 }, OWNER_ID, { now: new Date(FIXED_NOW_MS + 1000) });

    expect(outcome.appliedRowCount).toBe(0);
    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.serverVersion).toBe(7);
    expect(stored?.acceptedOpId).toBe(acknowledgement.acceptedOpId);
    void local;
    const ops = await fixture.db.select().from(pendingOpsTable);
    expect(ops).toHaveLength(0);
  });

  it('an older acknowledgement keeps the local version but still deletes the op', async () => {
    const fixture = await createRepoFixture();
    const repository = createSyncMergeRepository(fixture.db, { now: fixture.clock });
    await seedLocalRow(fixture, { serverVersion: 5, acceptedOpId: 'cccccccc-0000-4000-8000-000000000003' });
    const opId = 'eeeeeeee-0000-4000-8000-000000000005';
    await insertPendingOp(fixture.db, {
      opId,
      tableName: 'diary_entries',
      recordId: RECORD_ID,
      kind: 'upsert',
      snapshot: '{}',
      clientTimestamp: new Date(FIXED_NOW_MS),
      createdAt: new Date(FIXED_NOW_MS),
      dispatchAttempts: 0,
      nextRetryAt: null,
      quarantined: false,
    });

    await repository.apply(
      [{ opId, serverVersion: 2, acceptedOpId: 'aaaaaaaa-0000-4000-8000-000000000001', duplicate: false }],
      { rows: [], cursor: 0 },
      OWNER_ID,
      { now: new Date(FIXED_NOW_MS + 1000) },
    );

    const stored = await fetchDiaryEntry(fixture.db, RECORD_ID);
    expect(stored?.serverVersion).toBe(5);
    const ops = await fixture.db.select().from(pendingOpsTable);
    expect(ops).toHaveLength(0);
  });
});
