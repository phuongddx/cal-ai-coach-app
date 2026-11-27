/**
 * Jest twin of `SyncEngineDispatchTests.swift` (native/Modules/CoachCalSync): one case per Swift
 * test, same behavior sentence, real engine + real SQLite sync store (sql.js) + a scripted transport.
 */
import { SyncError } from './types';
import { MAX_OP_ATTEMPTS, SyncEngineError } from './engine';
import { BATCH_SIZE } from './engine';
import { backoffDelayMs } from './backoff';
import { makeHarness, recordFor, sleep, SyncTransportFailure, validAckResponse } from './testing/engineHarness';

const OP_ACCEPTED = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

describe('SyncEngineDispatchTests', () => {
  it('overlapping dispatch calls push the same batch only once', async () => {
    const harness = await makeHarness();
    const queued = await harness.seedOutbox(1);
    harness.transport.configure({ pushDelayMs: 25 });
    harness.transport.configure({ pushResponse: validAckResponse(queued) });

    await harness.engine.bind(harness.newId());
    await Promise.all([harness.engine.dispatch(), harness.engine.dispatch()]);

    expect(harness.transport.pushCalls).toHaveLength(1);
  });

  it('successful acknowledgements delete operations and bump canonical rows', async () => {
    const harness = await makeHarness();
    const [op] = await harness.seedOutbox(1);
    harness.transport.configure({
      pushResponse: {
        accepted: [
          {
            opId: op!.opId,
            status: 'applied',
            record: recordFor(op!.recordId, { serverVersion: 10, acceptedOpId: op!.opId }),
          },
        ],
      },
    });

    await harness.engine.bind(harness.newId());
    const result = await harness.engine.dispatch();

    expect(result.acked).toBe(1);
    expect(await harness.readPending(op!.opId)).toBeNull();
    const row = await harness.readEntry(op!.recordId);
    expect(row?.serverVersion).toBe(10);
    expect(row?.acceptedOpId).toBe(op!.opId);
  });

  it('transport failure schedules deterministic backoff and later replay is safe', async () => {
    const harness = await makeHarness();
    const [op] = await harness.seedOutbox(1);
    harness.transport.configure({ failure: new SyncTransportFailure() });

    await harness.engine.bind(harness.newId());
    const failure = await harness.engine.dispatch().then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as SyncError).cause).toBeInstanceOf(SyncTransportFailure);

    let failed = await harness.readPending(op!.opId);
    expect(failed?.dispatchAttempts).toBe(1);
    expect(new Date(failed!.nextRetryAt!).getTime()).toBe(harness.now.getTime() + 1_000);

    expect(backoffDelayMs(1)).toBe(1_000);
    expect(backoffDelayMs(2)).toBe(2_000);
    expect(backoffDelayMs(3)).toBe(4_000);
    expect(backoffDelayMs(6)).toBe(30_000);
    expect(backoffDelayMs(7)).toBe(30_000);

    harness.transport.configure({
      pushResponse: {
        accepted: [
          {
            opId: op!.opId,
            status: 'duplicate',
            record: recordFor(op!.recordId, { serverVersion: 11, acceptedOpId: OP_ACCEPTED }),
          },
        ],
      },
      failure: null,
    });
    await harness.clearRetryTime(op!.opId);

    await harness.engine.dispatch();
    failed = await harness.readPending(op!.opId);
    const row = await harness.readEntry(op!.recordId);
    expect(failed).toBeNull();
    expect(row?.serverVersion).toBe(11);
    expect(row?.acceptedOpId).toBe(OP_ACCEPTED);
  });

  it('permanently undecodable operation is dead-lettered without losing the row', async () => {
    const harness = await makeHarness();
    const opId = harness.newId();
    await harness.insertPendingRow({ opId, recordId: harness.newId(), kind: 'upsert', snapshot: 'not-json' });
    await harness.engine.bind(harness.newId());

    for (let attempt = 0; attempt < MAX_OP_ATTEMPTS - 1; attempt += 1) {
      const result = await harness.engine.dispatch();
      expect(result.poisoned).toBe(1);
      const retrying = await harness.readPending(opId);
      expect(retrying?.quarantined).toBe(false);
      // the Swift test dispatches again at once: the poisoned row's backoff is not waited for
      await harness.clearRetryTime(opId);
    }

    const final = await harness.engine.dispatch();
    expect(final.poisoned).toBe(1);

    const stored = await harness.readPending(opId);
    expect(stored?.quarantined).toBe(true);
    expect((await harness.store.dueOperations(BATCH_SIZE, harness.now.getTime())).undecodable).toEqual([]);
    expect((await harness.store.dueOperations(BATCH_SIZE, harness.now.getTime())).operations).toEqual([]);
  });

  it('debounced dispatch surfaces thrown errors through sink', async () => {
    const harness = await makeHarness({ debounceMs: 20 });
    await harness.seedOutbox(1);
    harness.transport.configure({ failure: new SyncTransportFailure() });
    const captured: unknown[] = [];
    harness.engine.setOnError((error) => captured.push(error));
    await harness.engine.bind(harness.newId());
    harness.engine.notifyLocalMutation();
    await sleep(300);

    expect(captured).toHaveLength(1);
    expect((captured[0] as SyncError).cause).toBeInstanceOf(SyncTransportFailure);
  });

  it('debounced dispatch surfaces poisoned operations through sink', async () => {
    const harness = await makeHarness({ debounceMs: 20 });
    await harness.insertPendingRow({ opId: harness.newId(), recordId: harness.newId(), kind: 'upsert', snapshot: 'not-json' });
    const captured: unknown[] = [];
    harness.engine.setOnError((error) => captured.push(error));
    await harness.engine.bind(harness.newId());
    harness.engine.notifyLocalMutation();
    await sleep(300);

    expect(captured.map((error) => String(error instanceof SyncEngineError ? `SyncEngineError: ${error.message}` : error))).toEqual([
      'SyncEngineError: poisonedOperations(count: 1)',
    ]);
  });

  it('pull skips newer pending intent but applies other rows and advances cursor', async () => {
    const harness = await makeHarness();
    const protectedRecord = harness.newId();
    const owner = harness.newId();
    await harness.insertMirror({
      id: protectedRecord,
      userId: owner,
      displayText: 'local intent',
      createdAt: harness.now,
      updatedAt: harness.now,
      deletedAt: null,
      serverVersion: 1,
      acceptedOpId: null,
      serverUpdatedAt: harness.now,
    });
    await harness.seedOutbox(1, {
      recordId: protectedRecord,
      nextRetryAt: new Date(harness.now.getTime() + 3_155_695_200_000),
      insertMirror: false,
    });

    const mergeableRecord = harness.newId();
    harness.transport.configure({
      pullResponse: {
        rows: [
          { seq: 10, record: recordFor(protectedRecord, { serverVersion: 10, acceptedOpId: harness.newId(), name: 'remote newer' }) },
          { seq: 12, record: recordFor(mergeableRecord, { serverVersion: 12, acceptedOpId: harness.newId(), name: 'remote new' }) },
        ],
        cursor: 12,
        hasMore: false,
      },
    });

    await harness.engine.bind(owner);
    const result = await harness.engine.dispatch();

    expect(result.pulled).toBe(2);
    const protectedRow = await harness.readEntry(protectedRecord);
    expect(protectedRow?.displayText).toBe('local intent');
    expect(protectedRow?.serverVersion).toBe(1);
    const appliedRow = await harness.readEntry(mergeableRecord);
    expect(appliedRow?.displayText).toBe('remote new');
    expect(await harness.readCursor()).toBe(12);
  });
});
