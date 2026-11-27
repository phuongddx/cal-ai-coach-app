/**
 * Jest twin of `AckIntegrityTests.swift`: an acknowledgement set that is not exactly the submitted set
 * rejects the whole batch, leaves the outbox as it was and never reaches the pull.
 */
import { makeHarness, recordFor } from './testing/engineHarness';

describe('AckIntegrityTests', () => {
  it('foreign acknowledgement rejects the whole batch', async () => {
    const harness = await makeHarness();
    const operations = await harness.seedOutbox(2);
    const foreign = harness.newId();
    harness.transport.configure({
      pushResponse: {
        accepted: [{ opId: foreign, status: 'applied', record: recordFor(harness.newId(), { serverVersion: 1, acceptedOpId: foreign }) }],
      },
    });

    await harness.engine.bind(harness.newId());
    await expect(harness.engine.dispatch()).rejects.toThrow();

    expect(await harness.readPendingIds()).toEqual(new Set(operations.map((op) => op.opId)));
    expect(harness.transport.pullCalls).toEqual([]);
  });

  it('duplicate acknowledgement rejects the whole batch', async () => {
    const harness = await makeHarness();
    const [operation] = await harness.seedOutbox(1);
    const ack = {
      opId: operation!.opId,
      status: 'applied' as const,
      record: recordFor(operation!.recordId, { serverVersion: 1, acceptedOpId: operation!.opId }),
    };
    harness.transport.configure({ pushResponse: { accepted: [ack, ack] } });

    await harness.engine.bind(harness.newId());
    await expect(harness.engine.dispatch()).rejects.toThrow();

    expect(await harness.readPendingIds()).toEqual(new Set([operation!.opId]));
    expect(harness.transport.pullCalls).toEqual([]);
  });

  it('partial acknowledgement rejects the whole batch', async () => {
    const harness = await makeHarness();
    const operations = await harness.seedOutbox(2);
    const first = operations[0]!;
    harness.transport.configure({
      pushResponse: {
        accepted: [{ opId: first.opId, status: 'applied', record: recordFor(first.recordId, { serverVersion: 1, acceptedOpId: first.opId }) }],
      },
    });

    await harness.engine.bind(harness.newId());
    await expect(harness.engine.dispatch()).rejects.toThrow();

    expect(await harness.readPendingIds()).toEqual(new Set(operations.map((op) => op.opId)));
    expect(harness.transport.pullCalls).toEqual([]);
  });
});
