/**
 * Jest twin of `TriggerTests.swift` plus the rising-edge rule of `NWPathTrigger`. The seams take the
 * AppState and NetInfo objects as arguments, so plain fakes drive them: no `jest.mock` needed here.
 */
import { BGTaskTrigger, ForegroundTrigger, NetworkTrigger, type SyncTriggering } from './triggerSeams';
import { makeHarness, sleep, validAckResponse } from './testing/engineHarness';

describe('TriggerTests', () => {
  it('foreground, network and BGTask seams invoke engine dispatch', async () => {
    const harness = await makeHarness();
    const operations = await harness.seedOutbox(3);
    harness.transport.configure({ pushResponse: validAckResponse(operations) });
    await harness.engine.bind(harness.newId());

    const engine = harness.engine;
    const fireEngine = (): void => {
      void engine.dispatch().catch(() => undefined);
    };
    const triggers: SyncTriggering[] = [
      new ForegroundTrigger(fireEngine),
      new NetworkTrigger(fireEngine),
      new BGTaskTrigger(fireEngine),
    ];

    for (const trigger of triggers) {
      trigger.fire();
    }
    await sleep(50);

    expect(harness.transport.pushCalls).toHaveLength(1);
  });
});

describe('trigger observation', () => {
  it('the foreground trigger fires when the app becomes active and not on other changes', () => {
    let listener: (state: string) => void = () => undefined;
    let removed = false;
    const fire = jest.fn();
    const stop = new ForegroundTrigger(fire).start({
      addEventListener: (_type, handler) => {
        listener = handler;
        return { remove: () => (removed = true) };
      },
    });

    listener('background');
    listener('inactive');
    expect(fire).not.toHaveBeenCalled();
    listener('active');
    expect(fire).toHaveBeenCalledTimes(1);

    stop();
    expect(removed).toBe(true);
  });

  it('the network trigger fires on the rising edge only', () => {
    let listener: (state: { isConnected: boolean | null }) => void = () => undefined;
    const fire = jest.fn();
    const readings: boolean[] = [];
    new NetworkTrigger(fire).start(
      {
        addEventListener: (handler) => {
          listener = handler;
          return () => undefined;
        },
      },
      (connected) => readings.push(connected),
    );

    listener({ isConnected: false });
    expect(fire).not.toHaveBeenCalled();
    listener({ isConnected: true });
    expect(fire).toHaveBeenCalledTimes(1);
    listener({ isConnected: true }); // a repeated "connected" reading is not an edge
    listener({ isConnected: null });
    expect(fire).toHaveBeenCalledTimes(1);
    listener({ isConnected: true }); // lost and regained: a new rising edge
    expect(fire).toHaveBeenCalledTimes(2);
    expect(readings).toEqual([false, true, true, false, true]);
  });

  it('the BGTask seam submits the request and then fires', () => {
    const order: string[] = [];
    new BGTaskTrigger(
      () => order.push('fire'),
      () => order.push('submit'),
    ).submit();
    expect(order).toEqual(['submit', 'fire']);
  });
});
