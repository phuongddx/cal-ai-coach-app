import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { migrationsBundle } from '../migrations';
import { openNodeSqliteTestDb } from '../testing/nodeSqlite';
import { diaryEntries, pendingOps, syncState } from '../schema';
import { runDispatch } from './dispatcher';
import type { SyncTransport } from './transport';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const REC_A = 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1';

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

function seedPending(
  db: TestDb['db'],
  ownerId: string,
  opId: string,
  recordId: string,
  seq: number
) {
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
        displayText: `${ownerId} draft`,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
      }),
      clientTimestamp: '2026-09-12T00:00:00.000Z',
      createdAt: '2026-09-12T00:00:00.000Z',
    })
    .run();
}

describe('owner partition across dispatcher runs (Plan 01-04 Task 2)', () => {
  let handle: TestDb;
  beforeEach(async () => {
    handle = await makeDb();
  });
  afterEach(() => {
    handle.client.closeSync();
  });

  it('a User B dispatch never sends User A operations', async () => {
    seedPending(handle.db, USER_A, 'ab1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e', REC_A, 1);
    seedPending(
      handle.db,
      USER_B,
      'cd1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
      'cccccccc-ccc3-4ccc-8ccc-ccccccccccc3',
      1
    );

    const pushed: unknown[] = [];
    const transport: SyncTransport = {
      async push(request) {
        pushed.push(request);
        return {
          accepted: request.operations.map((op) => ({
            opId: op.opId,
            serverVersion: 10,
            acceptedOpId: op.opId,
            duplicate: false,
          })),
        };
      },
      async pull(request) {
        return { rows: [], cursor: request.cursor };
      },
    };

    await runDispatch(handle.db, USER_B, { transport });

    const operations = (pushed[0] as { operations: { opId: string }[] }).operations;
    expect(operations.map((op) => op.opId)).toStrictEqual([
      'cd1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    ]);
    // A's queue untouched by B's run.
    expect(
      handle.db
        .select()
        .from(pendingOps)
        .all()
        .some((op) => op.ownerId === USER_A)
    ).toBe(true);
  });

  it('a User B dispatch cannot delete or advance User A queue or cursor state', async () => {
    seedPending(handle.db, USER_A, 'ab1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e', REC_A, 1);
    handle.db
      .insert(syncState)
      .values({ ownerId: USER_A, stream: 'diary_entries', pullCursor: 41 })
      .run();
    // A's mirror row exists locally; B's pull must not alter it.
    handle.db
      .insert(diaryEntries)
      .values({
        id: REC_A,
        ownerId: USER_A,
        displayText: `${USER_A} draft`,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      })
      .run();

    const transport: SyncTransport = {
      async push(request) {
        return {
          accepted: request.operations.map((op) => ({
            opId: op.opId,
            serverVersion: 10,
            acceptedOpId: op.opId,
            duplicate: false,
          })),
        };
      },
      async pull(request) {
        // Server (hostile or misrouted) sends User A's row to User B's pull.
        return {
          rows: [
            {
              table: 'diary_entries' as const,
              recordId: REC_A,
              snapshot: {
                id: REC_A,
                displayText: 'B SHOULD NOT WRITE THIS',
                deletedAt: null,
                serverVersion: 99,
                acceptedOpId: 'ab1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
              },
            },
          ],
          cursor: 99,
        };
      },
    };

    await runDispatch(handle.db, USER_B, { transport });

    // A's queue and cursor exactly as before.
    const aOps = handle.db
      .select()
      .from(pendingOps)
      .all()
      .filter((op) => op.ownerId === USER_A);
    expect(aOps).toHaveLength(1);
    expect(
      handle.db.select().from(syncState).all().find((c) => c.ownerId === USER_A)?.pullCursor
    ).toBe(41);

    // A's mirror row untouched by B's merge.
    const aRow = handle.db
      .select()
      .from(diaryEntries)
      .all()
      .find((r) => r.id === REC_A && r.ownerId === USER_A);
    expect(aRow?.displayText).toBe(`${USER_A} draft`);
  });
});
