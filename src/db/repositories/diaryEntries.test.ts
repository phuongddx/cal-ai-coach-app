import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { migrationsBundle } from '../migrations';
import { openNodeSqliteTestDb } from '../testing/nodeSqlite';
import { diaryEntries, pendingOps } from '../schema';
import {
  createDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  tombstoneDiaryEntry,
  updateDiaryEntry,
} from './diaryEntries';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

interface TestDb {
  client: ReturnType<typeof openNodeSqliteTestDb>;
  db: ExpoSQLiteDatabase;
}

async function makeDb(): Promise<TestDb> {
  const client = openNodeSqliteTestDb();
  const db = drizzle(client as never);
  await migrate(db, migrationsBundle);
  return { client, db };
}

describe('diaryEntries repository (owner-scoped atomic writes)', () => {
  let handle: TestDb;
  beforeEach(async () => {
    handle = await makeDb();
  });
  afterEach(() => {
    handle.client.closeSync();
  });

  it('create persists the owner row and exactly one outbox op with its full snapshot', () => {
    const entry = createDiaryEntry(handle.db, USER_A, 'Chicken rice bowl');

    const rows = handle.db.select().from(diaryEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(entry.id);
    expect(rows[0].ownerId).toBe(USER_A);

    const ops = handle.db.select().from(pendingOps).all();
    expect(ops).toHaveLength(1);
    expect(ops[0].ownerId).toBe(USER_A);
    expect(ops[0].tableName).toBe('diary_entries');
    expect(ops[0].kind).toBe('upsert');
    expect(ops[0].ownerSeq).toBe(1);

    const snapshot = JSON.parse(ops[0].snapshotJson);
    expect(snapshot.id).toBe(entry.id);
    expect(snapshot.displayText).toBe('Chicken rice bowl');
    expect(snapshot.serverVersion).toBe(0);
    expect(snapshot.acceptedOpId).toBeNull();
    expect(snapshot).not.toHaveProperty('userId');
  });

  it('update replaces display text and enqueues a new op in the same transaction', () => {
    const entry = createDiaryEntry(handle.db, USER_A, 'Oatmeal');
    updateDiaryEntry(handle.db, USER_A, entry.id, 'Oatmeal with berries');

    const fetched = getDiaryEntry(handle.db, USER_A, entry.id);
    expect(fetched?.displayText).toBe('Oatmeal with berries');

    const ops = handle.db.select().from(pendingOps).all();
    expect(ops).toHaveLength(2);
    expect(ops.map((op) => op.kind)).toStrictEqual(['upsert', 'upsert']);
    expect(ops[1].ownerSeq).toBe(2);
  });

  it('tombstone sets deletedAt and enqueues a tombstone op without deleting the row', () => {
    const entry = createDiaryEntry(handle.db, USER_A, 'Salad');
    tombstoneDiaryEntry(handle.db, USER_A, entry.id);

    const fetched = getDiaryEntry(handle.db, USER_A, entry.id);
    expect(fetched?.deletedAt).not.toBeNull();

    const ops = handle.db.select().from(pendingOps).all();
    expect(ops[1].kind).toBe('tombstone');
    expect(JSON.parse(ops[1].snapshotJson).deletedAt).not.toBeNull();
  });

  it('a forced outbox-order failure rolls the whole transaction back', () => {
    // Seam: inject an id generator whose id already exists in diary_entries,
    // so the MIRROR insert fails after the outbox insert inside the same
    // transaction. Both must roll back — proving no orphan durable intent.
    const preExistingId = 'aaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1';
    handle.db
      .insert(diaryEntries)
      .values({
        id: preExistingId,
        ownerId: USER_A,
        displayText: 'pre-existing',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      })
      .run();

    const opsBefore = handle.db.select().from(pendingOps).all();

    expect(() =>
      createDiaryEntry(handle.db, USER_A, 'will roll back', {
        newId: () => preExistingId,
      })
    ).toThrow();

    expect(handle.db.select().from(pendingOps).all()).toStrictEqual(opsBefore);
  });

  it('User B sees none of User A rows and cannot mutate them', () => {
    const entry = createDiaryEntry(handle.db, USER_A, 'Only A sees this');

    expect(listDiaryEntries(handle.db, USER_B)).toHaveLength(0);
    expect(listDiaryEntries(handle.db, USER_A)).toHaveLength(1);
    expect(getDiaryEntry(handle.db, USER_B, entry.id)).toBeUndefined();

    expect(() =>
      updateDiaryEntry(handle.db, USER_B, entry.id, 'hijack')
    ).toThrow();
    expect(() => tombstoneDiaryEntry(handle.db, USER_B, entry.id)).toThrow();

    // B's write lands under B with its own sequence — never touching A's queue.
    const bEntry = createDiaryEntry(handle.db, USER_B, 'B entry');
    const ops = handle.db.select().from(pendingOps).all();
    const bOps = ops.filter((op) => op.ownerId === USER_B);
    expect(bOps).toHaveLength(1);
    expect(bOps[0].ownerSeq).toBe(1);
    expect(bOps[0].recordId).toBe(bEntry.id);
    expect(getDiaryEntry(handle.db, USER_A, bEntry.id)).toBeUndefined();
  });
});
