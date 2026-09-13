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

  it('rejects an acknowledgement for an operation queued after submission', async () => {
    // Only OP_X is loaded into the submitted batch; OP_Y joins the queue
    // while the push is in flight, so a response acknowledging Y names an
    // operation that was never submitted.
    seedPending(handle.db, USER_A, OP_X, REC, 1);

    const { transport, pushed, pulled } = makeTransport({
      push: async () => {
        seedPending(handle.db, USER_A, OP_Y, REC, 2, 'queued during push');
        return {
          accepted: [
            { opId: OP_X, serverVersion: 10, acceptedOpId: OP_X, duplicate: false },
            { opId: OP_Y, serverVersion: 11, acceptedOpId: OP_Y, duplicate: false },
          ],
        };
      },
    });

    await expect(runDispatch(handle.db, USER_A, { transport })).rejects.toThrow(
      /unsent operation/
    );

    // Both the submitted and the unsent operation stay durable, byte-exact.
    const ops = handle.db.select().from(pendingOps).all();
    expect(ops).toHaveLength(2);
    const submittedRow = ops.find((op) => op.opId === OP_X);
    const unsentRow = ops.find((op) => op.opId === OP_Y);
    expect(submittedRow).toBeDefined();
    expect(unsentRow).toBeDefined();

    // Retry metadata lands only on the operation actually submitted.
    expect(submittedRow!.attempts).toBe(1);
    expect(submittedRow!.lastError).toMatch(/unsent operation/);
    expect(unsentRow!.attempts).toBe(0);
    expect(unsentRow!.lastError).toBeNull();

    expect(JSON.parse(submittedRow!.snapshotJson)).toStrictEqual({
      id: REC,
      displayText: 'offline edit',
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
    });
    expect(JSON.parse(unsentRow!.snapshotJson)).toStrictEqual({
      id: REC,
      displayText: 'queued during push',
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
    });

    // No acknowledgement side effects: mirror untouched, cursor unmoved,
    // pull never reached.
    expect(handle.db.select().from(diaryEntries).all()).toHaveLength(0);
    expect(
      handle.db
        .select()
        .from(syncState)
        .all()
        .find((c) => c.ownerId === USER_A)?.pullCursor ?? 0
    ).toBe(0);
    expect(pulled).toHaveLength(0);
    expect(pushed).toHaveLength(1);
  });

  it('rejects a duplicate acknowledgement for a submitted operation', async () => {
    // Both operations are submitted; the response names only submitted IDs
    // but repeats one, so no one-to-one correspondence exists.
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    seedPending(handle.db, USER_A, OP_Y, REC, 2);

    const { transport, pulled } = makeTransport({
      push: async () => ({
        accepted: [
          { opId: OP_X, serverVersion: 10, acceptedOpId: OP_X, duplicate: false },
          { opId: OP_X, serverVersion: 11, acceptedOpId: OP_X, duplicate: false },
        ],
      }),
    });

    await expect(runDispatch(handle.db, USER_A, { transport })).rejects.toThrow(
      /more than once/
    );

    // Rejected whole: identities unchanged, no partial acknowledgement, no
    // pull.
    const ops = handle.db.select().from(pendingOps).all();
    expect(ops.map((op) => op.opId).sort()).toStrictEqual([OP_X, OP_Y]);
    expect(ops.every((op) => op.attempts === 1 && op.lastError)).toBe(true);
    expect(pulled).toHaveLength(0);
  });

  it('rejects a response that omits a submitted operation', async () => {
    seedPending(handle.db, USER_A, OP_X, REC, 1);
    seedPending(handle.db, USER_A, OP_Y, REC, 2);

    const { transport, pulled } = makeTransport({
      push: async () => ({
        accepted: [
          { opId: OP_X, serverVersion: 10, acceptedOpId: OP_X, duplicate: false },
        ],
      }),
    });

    await expect(runDispatch(handle.db, USER_A, { transport })).rejects.toThrow(
      /partial acknowledgement/
    );

    // Rejected whole: the omitted operation was not partially acked and the
    // pull path never ran.
    const ops = handle.db.select().from(pendingOps).all();
    expect(ops.map((op) => op.opId).sort()).toStrictEqual([OP_X, OP_Y]);
    expect(ops.every((op) => op.attempts === 1 && op.lastError)).toBe(true);
    expect(pulled).toHaveLength(0);
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
