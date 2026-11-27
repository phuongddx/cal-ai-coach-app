/**
 * Jest twin of `LifecycleBarrierTests.swift`: stop() is a drain barrier for bind(), and a burst of
 * local mutations coalesces into one trailing dispatch.
 */
import { makeHarness, sleep, validAckResponse } from './testing/engineHarness';

describe('LifecycleBarrierTests', () => {
  it('stop drains in-flight dispatch before a new owner can bind', async () => {
    const harness = await makeHarness();
    const operations = await harness.seedOutbox(1);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.transport.configure({ pushResponse: validAckResponse(operations), pushWait: () => gate });
    const oldOwner = harness.newId();
    const newOwner = harness.newId();
    await harness.engine.bind(oldOwner);

    const dispatchTask = harness.engine.dispatch();
    while (harness.transport.pushCalls.length === 0) {
      await sleep(5);
    }
    const stopTask = harness.engine.stop();
    const bindTask = harness.engine.bind(newOwner);

    await sleep(50);
    expect(harness.transport.pushCalls).toHaveLength(1);
    const ownerBeforeRelease = harness.engine.currentOwner();
    expect(ownerBeforeRelease).not.toBe(newOwner);
    expect(ownerBeforeRelease).toBeNull();

    release();

    await dispatchTask;
    await stopTask;
    await bindTask;

    expect(harness.engine.currentOwner()).toBe(newOwner);
    expect(harness.transport.pushCalls).toHaveLength(1);
  });

  it('mutation burst coalesces into one trailing dispatch', async () => {
    const harness = await makeHarness({ debounceMs: 20 });
    const operations = await harness.seedOutbox(1);
    harness.transport.configure({ pushResponse: validAckResponse(operations) });
    await harness.engine.bind(harness.newId());

    for (let index = 0; index < 5; index += 1) {
      harness.engine.notifyLocalMutation();
    }
    await sleep(120);

    expect(harness.transport.pushCalls).toHaveLength(1);
    expect(await harness.readPending(operations[0]!.opId)).toBeNull();
  });
});
