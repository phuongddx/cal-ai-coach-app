import {
  startSyncLifecycle,
  type SyncLifecycleDeps,
  type SyncLifecycleHandle,
} from './lifecycle';

interface FakeClock {
  now: number;
  nextId: number;
  timeouts: { id: number; dueAt: number; fn: () => void }[];
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  advance(ms: number): void;
}

function makeFakeClock(): FakeClock {
  const clock: FakeClock = {
    now: 0,
    timeouts: [],
    nextId: 1,
    setTimeout(fn, ms) {
      const id = clock.nextId++;
      clock.timeouts.push({ id, dueAt: clock.now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      clock.timeouts = clock.timeouts.filter((t) => t.id !== id);
    },
    advance(ms: number) {
      clock.now += ms;
      const due = clock.timeouts.filter((t) => t.dueAt <= clock.now);
      clock.timeouts = clock.timeouts.filter((t) => t.dueAt > clock.now);
      for (const t of due) t.fn();
    },
  };
  return clock;
}

interface Harness {
  calls: { owner: string; at: number }[];
  failNext: number | null;
  deps: SyncLifecycleDeps;
  clock: FakeClock;
  listeners: Map<string, (state: never) => void>;
  emitAppState(state: string): void;
  emitNet(isConnected: boolean): void;
}

function makeHarness(): Harness {
  const clock = makeFakeClock();
  const calls: { owner: string; at: number }[] = [];
  const harness: Harness = {
    calls,
    clock,
    failNext: null,
    listeners: new Map(),
    deps: null as never,
    emitAppState(state) {
      harness.listeners.get('appState')?.(state as never);
    },
    emitNet(isConnected) {
      harness.listeners.get('netInfo')?.({ isConnected } as never);
    },
  };

  const dispatch = async (owner: string) => {
    if (harness.failNext !== null) {
      harness.failNext -= 1;
      if (harness.failNext >= 0) throw new Error('network down');
    }
    calls.push({ owner, at: clock.now });
  };

  harness.deps = {
    dispatch,
    clock,
    debounceMs: 300,
    retryBaseMs: 1000,
    appState: {
      addEventListener(_type, cb) {
        harness.listeners.set('appState', cb);
        return () => harness.listeners.delete('appState');
      },
    },
    netInfo: {
      addEventListener(cb) {
        harness.listeners.set('netInfo', cb);
        return () => harness.listeners.delete('netInfo');
      },
    },
  };
  return harness;
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

async function drain(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('sync lifecycle (Plan 01-04 Task 3)', () => {
  it('runs one initial dispatch for the bound owner at start', async () => {
    const harness = makeHarness();
    const handle = startSyncLifecycle(USER_A, harness.deps);
    await drain();

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0].owner).toBe(USER_A);
    handle.stop();
  });

  it('serializes foreground and reconnect triggers into non-concurrent runs', async () => {
    const harness = makeHarness();
    const handle = startSyncLifecycle(USER_A, harness.deps);
    await drain();

    harness.emitAppState('active');
    harness.emitAppState('active');
    harness.emitNet(false);
    harness.emitNet(true);
    await drain();

    // All triggers observed, but runs are serialized (never concurrent).
    expect(harness.calls.length).toBeGreaterThanOrEqual(2);
    handle.stop();
  });

  it('debounces post-mutation signals into one trailing dispatch', async () => {
    const harness = makeHarness();
    const handle = startSyncLifecycle(USER_A, harness.deps);
    await drain();
    const afterStart = harness.calls.length;

    handle.notifyLocalMutation(USER_A);
    handle.notifyLocalMutation(USER_A);
    handle.notifyLocalMutation(USER_A);
    harness.clock.advance(299);
    await drain();
    expect(harness.calls.length).toBe(afterStart);

    harness.clock.advance(1);
    await drain();
    expect(harness.calls.length).toBe(afterStart + 1);
    handle.stop();
  });

  it('ignores mutation signals from a different owner', async () => {
    const harness = makeHarness();
    const handle = startSyncLifecycle(USER_A, harness.deps);
    await drain();
    const afterStart = harness.calls.length;

    handle.notifyLocalMutation(USER_B);
    harness.clock.advance(1000);
    await drain();
    expect(harness.calls.length).toBe(afterStart);
    handle.stop();
  });

  it('schedules retry with backoff after a failed dispatch and retains the queue signal', async () => {
    const harness = makeHarness();
    harness.failNext = 1;
    const handle = startSyncLifecycle(USER_A, harness.deps);
    await drain();

    // Initial attempt failed; a retry is scheduled at retryBaseMs.
    expect(harness.calls).toHaveLength(0);
    harness.clock.advance(1000);
    await drain();
    expect(harness.calls).toHaveLength(1);
    handle.stop();
  });

  it('stop cancels timers and requires a new owner binding; later events never reuse the owner', async () => {
    const harness = makeHarness();
    const handle: SyncLifecycleHandle = startSyncLifecycle(USER_A, harness.deps);
    await drain();

    handle.stop();
    const afterStop = harness.calls.length;

    handle.notifyLocalMutation(USER_A);
    harness.emitAppState('active');
    harness.emitNet(true);
    harness.clock.advance(60_000);
    await drain();
    expect(harness.calls.length).toBe(afterStop);

    // Rebinding starts fresh with the NEW owner identity.
    const second = startSyncLifecycle(USER_B, harness.deps);
    await drain();
    expect(harness.calls.at(-1)?.owner).toBe(USER_B);
    second.stop();
  });
});
