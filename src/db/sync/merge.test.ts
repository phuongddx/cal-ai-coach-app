import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { migrationsBundle } from '../migrations';
import { openNodeSqliteTestDb } from '../testing/nodeSqlite';
import { diaryEntries, pendingOps, syncState, type DiaryEntry } from '../schema';
import { applyAcknowledgement, applyPullResponse } from './merge';
import type { PullResponse, PushAcknowledgement } from '../../contracts/sync';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const REC = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1';
const OP_X = '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e';
const OP_Y = '6b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e';

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

function seedLocalRow(
  db: TestDb['db'],
  over: Partial<DiaryEntry> & { id: string; ownerId: string }
) {
  db.insert(diaryEntries)
    .values({
      displayText: 'local draft',
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
      ...over,
    })
    .run();
}

function seedPending(db: TestDb['db'], ownerId: string, opId: string, recordId: string, seq: number) {
  db.insert(pendingOps)
    .values({
      opId,
      ownerId,
      ownerSeq: seq,
      tableName: 'diary_entries',
      recordId,
      kind: 'upsert',
      snapshotJson: JSON.stringify({
        id: recordId,
        displayText: 'pending draft',
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
      }),
      clientTimestamp: '2026-09-12T00:00:00.000Z',
      createdAt: '2026-09-12T00:00:00.000Z',
    })
    .run();
}

function pullRow(serverVersion: number, acceptedOpId: string, displayText: string, deletedAt: string | null) {
  return {
    table: 'diary_entries' as const,
    recordId: REC,
    snapshot: {
      id: REC,
      displayText,
      deletedAt,
      serverVersion,
      acceptedOpId,
    },
  };
}

describe('owner-scoped canonical merge (Plan 01-04 Task 1)', () => {
  let handle: TestDb;
  beforeEach(async () => {
    handle = await makeDb();
  });
  afterEach(() => {
    handle.client.closeSync();
  });

  it('materializes a remote tombstone as a stored deleted row', () => {
    const response: PullResponse = {
      rows: [pullRow(3, OP_X, 'Chicken rice', '2026-09-12T05:00:00.000Z')],
      cursor: 3,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, response);
    });

    const row = handle.db
      .select()
      .from(diaryEntries)
      .all()
      .find((r) => r.id === REC);
    expect(row?.ownerId).toBe(USER_A);
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.serverVersion).toBe(3);
  });

  it('applies newer remote rows, skips stale ones, and is idempotent on replay', () => {
    seedLocalRow(handle.db, {
      id: REC,
      ownerId: USER_A,
      serverVersion: 5,
      acceptedOpId: OP_Y,
    });

    const stale: PullResponse = {
      rows: [pullRow(2, OP_X, 'STALE', null)],
      cursor: 5,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, stale);
    });
    expect(
      handle.db.select().from(diaryEntries).all().find((r) => r.id === REC)?.displayText
    ).toBe('local draft');

    const newer: PullResponse = {
      rows: [pullRow(6, OP_X, 'NEWER', null)],
      cursor: 6,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, newer);
    });
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, newer);
    });
    const row = handle.db.select().from(diaryEntries).all().find((r) => r.id === REC);
    expect(row?.displayText).toBe('NEWER');
    expect(row?.serverVersion).toBe(6);
  });

  it('converges: the same accepted rows in reverse order yield identical final state', () => {
    const forward: PullResponse = {
      rows: [
        pullRow(1, OP_X, 'version one', null),
        pullRow(2, OP_Y, 'version two', '2026-09-12T06:00:00.000Z'),
      ],
      cursor: 2,
    };
    const reverse: PullResponse = {
      rows: [...forward.rows].reverse(),
      cursor: 2,
    };

    handle.db.transaction((tx) => applyPullResponse(tx, USER_A, forward));
    const afterForward = handle.db.select().from(diaryEntries).all();

    handle.db.delete(diaryEntries).run();
    handle.db.transaction((tx) => applyPullResponse(tx, USER_A, reverse));
    const afterReverse = handle.db.select().from(diaryEntries).all();

    const semantic = (rows: DiaryEntry[]) =>
      rows
        .map(({ createdAt: _c, updatedAt: _u, syncedAt: _s, ...rest }) => rest)
        .sort((a, b) => a.id.localeCompare(b.id));
    expect(semantic(afterReverse)).toStrictEqual(semantic(afterForward));
    expect(afterForward.find((r) => r.id === REC)?.displayText).toBe('version two');
  });

  it('preserves local state when an unsynced pending operation exists for the record', () => {
    seedLocalRow(handle.db, {
      id: REC,
      ownerId: USER_A,
      displayText: 'offline edit',
    });
    seedPending(handle.db, USER_A, OP_X, REC, 1);

    const remote: PullResponse = {
      rows: [pullRow(9, OP_Y, 'REMOTE', null)],
      cursor: 9,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, remote);
    });

    const row = handle.db.select().from(diaryEntries).all().find((r) => r.id === REC);
    expect(row?.displayText).toBe('offline edit');
    expect(row?.serverVersion).toBe(0);
    expect(handle.db.select().from(pendingOps).all()).toHaveLength(1);
  });

  it('applies an acknowledgement: removes only that op, bumps canonical fields, keeps siblings pending', () => {
    seedLocalRow(handle.db, {
      id: REC,
      ownerId: USER_A,
      displayText: 'offline edit',
    });
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    seedPending(handle.db, USER_A, OP_Y, REC, 2);

    const ack: PushAcknowledgement = {
      opId: OP_X,
      serverVersion: 7,
      acceptedOpId: OP_X,
      duplicate: false,
    };
    handle.db.transaction((tx) => {
      applyAcknowledgement(tx, USER_A, ack);
    });

    const ops = handle.db.select().from(pendingOps).all();
    expect(ops.map((op) => op.opId)).toStrictEqual([OP_Y]);
    const row = handle.db.select().from(diaryEntries).all().find((r) => r.id === REC);
    expect(row?.serverVersion).toBe(7);
    expect(row?.acceptedOpId).toBe(OP_X);
  });

  it('treats an unmatched (duplicate) acknowledgement as a stable no-op', () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    const before = handle.db.select().from(pendingOps).all();

    const ack: PushAcknowledgement = {
      opId: OP_Y,
      serverVersion: 7,
      acceptedOpId: OP_Y,
      duplicate: true,
    };
    handle.db.transaction((tx) => {
      applyAcknowledgement(tx, USER_A, ack);
    });

    expect(handle.db.select().from(pendingOps).all()).toStrictEqual(before);
  });

  it('advances only the matching owner cursor and never crosses sessions', () => {
    const response: PullResponse = {
      rows: [pullRow(4, OP_X, 'A row', null)],
      cursor: 4,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_A, response);
    });

    // User B applies a pull — must not see or change User A state.
    const bResponse: PullResponse = {
      rows: [
        {
          table: 'diary_entries',
          recordId: REC,
          snapshot: {
            id: REC,
            displayText: 'B SHOULD NOT WRITE THIS',
            deletedAt: null,
            serverVersion: 99,
            acceptedOpId: OP_Y,
          },
        },
      ],
      cursor: 99,
    };
    handle.db.transaction((tx) => {
      applyPullResponse(tx, USER_B, bResponse);
    });

    const cursors = handle.db.select().from(syncState).all();
    expect(cursors).toHaveLength(2);
    expect(cursors.find((c) => c.ownerId === USER_A)?.pullCursor).toBe(4);
    expect(cursors.find((c) => c.ownerId === USER_B)?.pullCursor).toBe(99);

    const aRow = handle.db
      .select()
      .from(diaryEntries)
      .all()
      .find((r) => r.id === REC && r.ownerId === USER_A);
    expect(aRow?.displayText).toBe('A row');
  });
});
