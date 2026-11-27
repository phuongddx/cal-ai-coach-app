/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/DiaryEntryRepositoryTests.swift —
 * one case per Swift test, the same behavior sentences.
 */
import { pendingOps } from '../db/schema';
import { reopenSqlJsDb } from '../db/testing/sqlJsDb';
import { countRows, createDiaryEntryRepository, fetchDiaryEntry, fetchPendingOp, type DiaryEntry } from './diaryEntryRepository';
import { createRepoFixture, FIXED_NOW_MS, type RepoFixture } from './testing/fixtures';

class TestFailure extends Error {}

const USER_ID = '04bbb783-bbe3-4a11-be45-6b77e3d23b20';
const ENTRY_ID = 'b07537f5-5709-45fa-b4c6-20cb5f0f1a1f';
const BASE_MS = FIXED_NOW_MS;

function makeEntry(displayText = 'Oatmeal'): DiaryEntry {
  const timestamp = new Date(BASE_MS);
  return {
    id: ENTRY_ID,
    userId: USER_ID,
    displayText,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    serverVersion: 0,
    acceptedOpId: null,
    serverUpdatedAt: timestamp,
  };
}

type Repository = ReturnType<typeof createDiaryEntryRepository>;

async function makeFixture(): Promise<{ fixture: RepoFixture; repository: Repository }> {
  const fixture = await createRepoFixture();
  const repository = createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock });
  return { fixture, repository };
}

describe('DiaryEntryRepositoryTests twins', () => {
  it('record upsert writes the diary and the outbox atomically', async () => {
    const { fixture, repository } = await makeFixture();
    const entry = makeEntry();
    const now = new Date(BASE_MS + 50_000);

    const operation = await repository.recordUpsert(entry, { now });

    expect(operation.kind).toBe('upsert');
    expect(operation.recordId).toBe(entry.id);
    const storedEntry = await fetchDiaryEntry(fixture.db, entry.id);
    const storedOperation = await fetchPendingOp(fixture.db, operation.opId);
    expect(storedEntry).toEqual(entry);
    expect(storedOperation).toEqual(operation);
  });

  it('batch upsert writes entries, details and the outbox together', async () => {
    const { fixture, repository } = await makeFixture();
    const now = new Date(BASE_MS + 50_000);
    const upserts = [0, 1].map((index) => {
      const entry: DiaryEntry = {
        id: fixture.newId(),
        userId: USER_ID,
        displayText: `Row ${index}`,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
        serverUpdatedAt: now,
      };
      return {
        entry,
        detail: {
          entryId: entry.id,
          mealSlot: 'lunch',
          title: `Row ${index}`,
          grams: 100,
          kcal: 100,
          proteinG: null,
          carbsG: null,
          fatG: null,
          fiberG: null,
          confidence: null,
          hiddenFatLikely: false,
          source: 'scan',
          unresolved: false,
          scanId: null,
        },
      };
    });

    const operations = await repository.recordUpserts(upserts, now);

    expect(operations).toHaveLength(2);
    expect(new Set(operations.map((operation) => operation.recordId))).toEqual(
      new Set(upserts.map((upsert) => upsert.entry.id)),
    );
    expect(await countRows(fixture.db, 'diary_entries')).toBe(2);
    expect(await countRows(fixture.db, 'diary_entry_details')).toBe(2);
    expect(await countRows(fixture.db, 'pending_ops')).toBe(2);
  });

  it('a mid-transaction failure rolls back both writes', async () => {
    const { fixture, repository } = await makeFixture();
    const entry = makeEntry();

    await expect(
      repository.recordUpsert(entry, {
        now: new Date(),
        transactionHook: () => {
          throw new TestFailure('injected failure');
        },
      }),
    ).rejects.toBeInstanceOf(TestFailure);

    expect(await countRows(fixture.db, 'diary_entries')).toBe(0);
    expect(await countRows(fixture.db, 'pending_ops')).toBe(0);
  });

  it('a failing pending-op insert leaves no mirror row or detail behind (acceptance)', async () => {
    // Both entries get the SAME op id: the second pending-op insert violates
    // the primary key, aborting the batch — the first entry's mirror row,
    // detail row and op must roll back too, never leave k-of-n behind.
    const fixture = await createRepoFixture();
    const repository = createDiaryEntryRepository(fixture.db, {
      newId: () => 'd0f0f0f0-0000-4000-8000-000000000dup',
      now: fixture.clock,
    });
    const now = new Date(BASE_MS + 50_000);
    const entries: DiaryEntry[] = [0, 1].map((index) => ({
      ...makeEntry(),
      id: fixture.newId(),
      displayText: `Row ${index}`,
    }));
    const upserts = entries.map((entry) => ({
      entry,
      detail: {
        entryId: entry.id,
        mealSlot: 'lunch',
        title: entry.displayText,
        grams: 100,
        kcal: 100,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
        confidence: null,
        hiddenFatLikely: false,
        source: 'scan',
        unresolved: false,
        scanId: null,
      },
    }));

    await expect(repository.recordUpserts(upserts, now)).rejects.toThrow();

    expect(await countRows(fixture.db, 'diary_entries')).toBe(0);
    expect(await countRows(fixture.db, 'diary_entry_details')).toBe(0);
    expect(await countRows(fixture.db, 'pending_ops')).toBe(0);
  });

  it('committed writes survive pool close and reopen', async () => {
    const { fixture, repository } = await makeFixture();
    const entry = makeEntry();
    const operation = await repository.recordUpsert(entry, { now: new Date(BASE_MS + 50_000) });

    const reopened = await reopenSqlJsDb(fixture.client.export());

    expect(await fetchDiaryEntry(reopened.db, entry.id)).toEqual(entry);
    expect(await fetchPendingOp(reopened.db, operation.opId)).toEqual(operation);
    const ops = await reopened.db.select().from(pendingOps);
    expect(ops).toHaveLength(1);
  });

  it('record tombstone writes the tombstone and the outbox op atomically', async () => {
    const { fixture, repository } = await makeFixture();
    const entry = makeEntry();
    await repository.recordUpsert(entry, { now: fixture.clock() });

    const deletedAt = new Date(BASE_MS + 100_000);
    const tombstoned: DiaryEntry = { ...entry, deletedAt, updatedAt: deletedAt };
    const operation = await repository.recordTombstone(tombstoned, { now: deletedAt });

    expect(operation.kind).toBe('tombstone');
    const storedEntry = await fetchDiaryEntry(fixture.db, entry.id);
    const storedOperation = await fetchPendingOp(fixture.db, operation.opId);
    expect(storedEntry?.deletedAt).toEqual(deletedAt);
    expect(storedOperation?.kind).toBe('tombstone');

    const snapshot = JSON.parse(operation.snapshot) as {
      id: string;
      displayText: string;
      deletedAt: string | null;
      serverVersion: number;
      acceptedOpId: string | null;
    };
    expect(snapshot).toEqual({
      id: entry.id,
      displayText: entry.displayText,
      deletedAt: deletedAt.toISOString(),
      serverVersion: 0,
      acceptedOpId: null,
    });
  });
});
