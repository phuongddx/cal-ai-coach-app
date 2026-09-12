import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { migrationsBundle } from '../migrations';
import { openNodeSqliteTestDb } from '../testing/nodeSqlite';
import { diaryEntries, pendingOps, syncState } from '../schema';
import { runDispatch } from './dispatcher';
import type { SyncTransport } from './transport';

const USER_A = '11111111-1111-4111-8111-111111111111';
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

function seedPending(
  db: TestDb['db'],
  ownerId: string,
  opId: string,
  recordId: string,
  seq: number,
  displayText = 'offline edit'
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
        displayText,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
      }),
      clientTimestamp: '2026-09-12T00:00:00.000Z',
      createdAt: '2026-09-12T00:00:00.000Z',
    })
    .run();
}

function makeTransport(over: {
  push?: SyncTransport['push'];
  pull?: SyncTransport['pull'];
} = {}): { transport: SyncTransport; pushed: unknown[]; pulled: unknown[] } {
  const pushed: unknown[] = [];
  const pulled: unknown[] = [];
  return {
    pushed,
    pulled,
    transport: {
      async push(request) {
        pushed.push(request);
        if (over.push) return over.push(request);
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
        pulled.push(request);
        if (over.pull) return over.pull(request);
        return { rows: [], cursor: request.cursor };
      },
    },
  };
}

describe('dispatcher (Plan 01-04 Task 2)', () => {
  let handle: TestDb;
  beforeEach(async () => {
    handle = await makeDb();
  });
  afterEach(() => {
    handle.client.closeSync();
  });

  it('pushes stored envelopes in owner sequence order, acks them, and advances the cursor', async () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    seedPending(handle.db, USER_A, OP_Y, REC, 2);

    const { transport, pushed } = makeTransport({
      pull: async (request) => ({
        rows: [
          {
            table: 'diary_entries' as const,
            recordId: 'cccccccc-ccc3-4ccc-8ccc-ccccccccccc3',
            snapshot: {
              id: 'cccccccc-ccc3-4ccc-8ccc-ccccccccccc3',
              displayText: 'from another device',
              deletedAt: null,
              serverVersion: 11,
              acceptedOpId: OP_Y,
            },
          },
        ],
        cursor: 11,
      }),
    });

    const result = await runDispatch(handle.db, USER_A, { transport });

    expect(pushed).toHaveLength(1);
    const operations = (pushed[0] as { operations: { opId: string }[] }).operations;
    expect(operations.map((op) => op.opId)).toStrictEqual([OP_X, OP_Y]);
    expect(result.cursorAdvanced).toBe(true);

    // Acks applied: both ops gone; pull merged + cursor advanced.
    expect(handle.db.select().from(pendingOps).all()).toHaveLength(0);
    expect(
      handle.db.select().from(syncState).all().find((c) => c.ownerId === USER_A)?.pullCursor
    ).toBe(11);
    expect(
      handle.db
        .select()
        .from(diaryEntries)
        .all()
        .some((r) => r.displayText === 'from another device')
    ).toBe(true);
  });

  it('caps a push batch at 50 operations', async () => {
    for (let i = 1; i <= 55; i += 1) {
      seedPending(
        handle.db,
        USER_A,
        `${i.toString().padStart(8, '0')}-0000-4000-8000-000000000000`,
        REC,
        i
      );
    }
    const { transport, pushed } = makeTransport();
    const result = await runDispatch(handle.db, USER_A, { transport });

    expect((pushed[0] as { operations: unknown[] }).operations).toHaveLength(50);
    expect(handle.db.select().from(pendingOps).all()).toHaveLength(5);
    expect(result.pushed).toBe(50);
  });

  it('a push failure leaves the queue intact, records the attempt, and skips pull', async () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    seedPending(handle.db, USER_A, OP_Y, REC, 2);

    const { transport, pulled } = makeTransport({
      push: async () => {
        throw new Error('network down');
      },
    });

    await expect(runDispatch(handle.db, USER_A, { transport })).rejects.toThrow(
      'network down'
    );

    const ops = handle.db.select().from(pendingOps).all();
    expect(ops).toHaveLength(2);
    expect(ops.every((op) => op.attempts === 1 && op.lastError === 'network down')).toBe(true);
    expect(pulled).toHaveLength(0);
  });

  it('a schema-invalid server response is treated as a transport failure', async () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    const { transport } = makeTransport({
      push: async () => ({ accepted: [{ opId: OP_X }] as never }),
    });

    await expect(runDispatch(handle.db, USER_A, { transport })).rejects.toThrow();
    expect(handle.db.select().from(pendingOps).all()).toHaveLength(1);
  });

  it('isolates a poison operation instead of blocking the queue', async () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    handle.db
      .update(pendingOps)
      .set({ snapshotJson: '{corrupt' })
      .where(undefined as never)
      .run();
    seedPending(handle.db, USER_A, OP_Y, REC, 2, 'healthy');

    const { transport, pushed } = makeTransport();
    const result = await runDispatch(handle.db, USER_A, { transport });

    const batch = (pushed[0] as { operations: { opId: string }[] }).operations;
    expect(batch.map((op) => op.opId)).toStrictEqual([OP_Y]);
    expect(result.poisoned).toBe(1);
  });
});
