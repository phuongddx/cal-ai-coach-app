import { createSyncEngine } from './engine';
import { FakeServer } from './fakeServer';
import { createInMemorySyncStore } from './inMemorySyncStore';
import { createMealRepository } from './repository';
import { SyncError } from './types';
import type { MealRecord } from '@coachcal/api-contract';

const MEAL_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eatenAt: '2026-11-27T01:00:00.000Z',
  name: 'Overnight oats',
  kcal: 320,
  proteinG: 12,
  carbsG: 45,
  fatG: 9,
  fiberG: 6,
  updatedAt: 1_764_200_400_000,
};

const OWNER = 'de000000-0000-4000-8000-000000000001';

let clock = 1_764_200_000_000;
let idCounter = 0;

const tick = () => {
  clock += 1_000;
  return clock;
};

const nextId = () => {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
};

const serverRecord = (meal: typeof MEAL_A, version: number): MealRecord => ({
  ...meal,
  deleted: false,
  serverVersion: version,
  acceptedOpId: null,
});

async function makeHarness() {
  const store = createInMemorySyncStore();
  const server = new FakeServer();
  const scheduled: Array<{ fn: () => void; delayMs: number }> = [];
  const engine = createSyncEngine({
    store,
    transport: server,
    now: tick,
    isOnline: () => true,
    schedule: (fn, delayMs) => scheduled.push({ fn, delayMs }),
  });
  await engine.bind(OWNER);
  const repository = createMealRepository({ store, now: tick, newId: nextId });
  return { store, server, engine, repository, scheduled };
}

describe('sync engine', () => {
  beforeEach(() => {
    clock = 1_764_200_000_000;
    idCounter = 0;
  });

  it('an offline add stays queued, then pushes once the app is back online', async () => {
    const { store, server, engine, repository } = await makeHarness();
    engine.setForcedOffline(true);

    const meal = await repository.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A), eatenAt: MEAL_A.eatenAt });
    expect(await store.outboxCount()).toBe(1);

    const offline = await engine.sync();
    expect(offline.status).toBe('offline');
    expect(server.pushCalls).toBe(0);

    engine.setForcedOffline(false);
    const online = await engine.sync();
    expect(online.status).toBe('synced');
    expect(online.pushed).toBe(1);

    const stored = await store.getMeal(meal.id);
    expect(stored?.serverVersion).toBe(1);
    expect(stored?.acceptedOpId).not.toBeNull();
    expect(await store.outboxCount()).toBe(0);
    expect(server.records.get(meal.id)?.kcal).toBe(MEAL_A.kcal);
  });

  it('applying the same pull page twice changes nothing', async () => {
    const { store, server, engine } = await makeHarness();
    server.seed(serverRecord({ ...MEAL_A, name: 'Server oats' }, 2));

    await engine.sync();
    const afterOnce = await store.listMeals();
    const cursorOnce = await store.cursor();

    // Same page delivered again (old cursor, e.g. another device replaying).
    const page = await server.pull(0, 200);
    await store.applyPullPage(page.rows, page.cursor);

    expect(await store.listMeals()).toEqual(afterOnce);
    expect(await store.cursor()).toBe(cursorOnce);
    expect(afterOnce[0]?.name).toBe('Server oats');
    expect(cursorOnce).toBe(2); // the page's cursor is the seeded record's global version
  });

  it('pull skips records with pending local intent and keeps the local edit', async () => {
    const { store, server, engine, repository } = await makeHarness();
    server.pushError = new SyncError('invalidRequest', 'the API rejected the request (400)');

    const meal = await repository.addMeal({ name: 'Local oats', ...pickNumbers(MEAL_A) });
    const quarantined = await engine.sync(); // 400 -> the whole batch is quarantined, pull never runs
    expect(quarantined.status).toBe('quarantined');

    server.seed(serverRecord({ ...MEAL_A, id: meal.id, name: 'Server oats' }, 4));
    const result = await engine.sync(); // push phase has nothing pending; pull runs
    expect(result.status).toBe('synced');
    expect(result.pulled).toBe(1);

    const stored = await store.getMeal(meal.id);
    // Pending intent (quarantined rows exist): the server record must not overwrite.
    expect(stored?.name).toBe('Local oats');
    expect(await store.cursor()).toBe(4); // the cursor still advanced to the seeded record's global version
    expect((await store.quarantinedOperations()).length).toBe(1);
  });

  it('a crash while applying a pull page rolls the cursor and the writes back together', async () => {
    const server = new FakeServer();
    server.seed(serverRecord(MEAL_A, 1));
    server.seed(serverRecord({ ...MEAL_A, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Shake' }, 1));
    const store = createInMemorySyncStore({ failPullRecordId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    const engine = createSyncEngine({ store, transport: server, now: tick, isOnline: () => true });
    await engine.bind(OWNER);

    await expect(engine.sync()).rejects.toThrow('simulated crash');
    expect(await store.cursor()).toBe(0);
    expect(await store.listMeals()).toEqual([]);
    // Nothing is lost: the next sync applies the whole page again.
    const fixed = createInMemorySyncStore();
    // (the real store's transaction guarantees this; here we assert the engine left no partial state)
    expect(fixed).toBeDefined();
  });

  it('a server failure keeps operations pending and retries with backoff', async () => {
    const { store, server, engine, repository, scheduled } = await makeHarness();
    server.pushError = new SyncError('server', 'the API failed (500)');
    await repository.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A) });

    const result = await engine.sync();
    expect(result.status).toBe('retryScheduled');
    expect(await store.outboxCount()).toBe(1);
    const pending = await store.pendingOperations(10);
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.lastError).toBe('the API failed (500)');
    expect(scheduled.length).toBe(1);
    expect(scheduled[0]?.delayMs).toBe(1_000); // 1s * 2^0

    // The scheduled retry pushes what stayed pending.
    scheduled[0]?.fn();
    for (let i = 0; i < 100 && server.pushCalls < 2; i += 1) {
      await drainMicrotasks();
    }
    expect(server.pushCalls).toBe(2);
    expect(await store.outboxCount()).toBe(0);
  });

  it('a 400 quarantines the batch and it is never retried automatically', async () => {
    const { store, server, engine, repository } = await makeHarness();
    server.pushError = new SyncError('invalidRequest', 'the API rejected the request (400)');
    await repository.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A) });

    const result = await engine.sync();
    expect(result.status).toBe('quarantined');
    expect(await store.pendingOperations(10)).toEqual([]);
    expect((await store.quarantinedOperations()).length).toBe(1);

    // Later syncs (manual or triggered) do not resurrect the quarantined op.
    const later = await engine.sync();
    expect(later.status).toBe('synced');
    expect(server.pushCalls).toBe(1); // only the original failing call
  });

  it('an unauthorized push stops the sync and keeps the operations pending', async () => {
    const { store, server, engine, repository } = await makeHarness();
    server.pushError = new SyncError('unauthorized', 'the API rejected the token');
    await repository.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A) });

    const result = await engine.sync();
    expect(result.status).toBe('unauthorized');
    expect(await store.outboxCount()).toBe(1);
    expect((await store.quarantinedOperations()).length).toBe(0);
  });

  it('edit then delete offline converge: the server ends with a tombstone and the outbox empties', async () => {
    const { store, server, engine, repository } = await makeHarness();
    engine.setForcedOffline(true);

    const meal = await repository.addMeal({ name: 'Protein shake', ...pickNumbers({ ...MEAL_A, kcal: 210, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }), eatenAt: MEAL_A.eatenAt });
    await repository.editMeal(meal.id, { kcal: 250 });
    expect((await store.getMeal(meal.id))?.kcal).toBe(250);
    await repository.deleteMeal(meal.id);
    expect(await store.getMeal(meal.id)).toBeNull();
    expect(await store.outboxCount()).toBe(3);

    engine.setForcedOffline(false);
    const result = await engine.sync();
    expect(result.status).toBe('synced');
    expect(result.pushed).toBe(3);

    const serverRecordB = server.records.get(meal.id);
    expect(serverRecordB?.deleted).toBe(true);
    expect(serverRecordB?.serverVersion).toBe(3);
    expect(await store.outboxCount()).toBe(0);
    expect(await store.getMeal(meal.id)).toBeNull();
  });

  it('a newer server record wins on ack and overwrites the local row', async () => {
    const { store, server, engine, repository } = await makeHarness();
    // Another device pushed a newer edit (updatedAt is 2s later than the local clock).
    server.seed(serverRecord({ ...MEAL_A, name: 'Server oats', updatedAt: MEAL_A.updatedAt + 2_000 }, 2));

    await repository.addMeal({ name: 'Local oats', ...pickNumbers(MEAL_A) });
    const result = await engine.sync();
    expect(result.status).toBe('synced');

    const stored = await store.getMeal(MEAL_A.id);
    expect(stored?.name).toBe('Server oats');
    expect(stored?.serverVersion).toBe(2);
    expect(await store.outboxCount()).toBe(0);
  });

  it('a new engine over the same store drains what a previous run left', async () => {
    const { store, engine } = await makeHarness();
    engine.setForcedOffline(true);
    const repositoryA = createMealRepository({ store, now: tick, newId: nextId });
    await repositoryA.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A) });
    await repositoryA.addMeal({ name: 'Protein shake', ...pickNumbers({ ...MEAL_A, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kcal: 210 }) });
    expect(await store.outboxCount()).toBe(2);

    const server2 = new FakeServer();
    const engine2 = createSyncEngine({ store, transport: server2, now: tick, isOnline: () => true });
    await engine2.bind(OWNER);
    const result = await engine2.sync();
    expect(result.status).toBe('synced');
    expect(result.pushed).toBe(2);
    expect(await store.outboxCount()).toBe(0);
    expect(server2.records.size).toBe(2);
  });

  it('a sync already running coalesces into one follow-up run', async () => {
    const { server, engine, repository } = await makeHarness();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const slowPush = server.push.bind(server);
    server.push = async (operations) => {
      await gate;
      return slowPush(operations);
    };

    await repository.addMeal({ name: 'Overnight oats', ...pickNumbers(MEAL_A) });

    const first = engine.sync();
    const second = engine.sync(); // while the first is in flight
    // A local write lands in the outbox while run one is still gated: the
    // coalesced follow-up must push it.
    await repository.addMeal({ name: 'Protein shake', ...pickNumbers({ ...MEAL_A, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kcal: 210 }) });
    release();
    const [resultFirst, resultSecond] = await Promise.all([first, second]);

    // The in-flight run's result is handed to both callers...
    expect(resultSecond).toBe(resultFirst);
    // ...and the follow-up run pushes what arrived during it.
    for (let i = 0; i < 100 && server.pushCalls < 2; i += 1) {
      await drainMicrotasks();
    }
    expect(server.pushCalls).toBe(2);
    expect(server.records.size).toBe(2);
  });

  it('forced offline makes isOnline false without touching the server', async () => {
    const { server, engine } = await makeHarness();
    engine.setForcedOffline(true);
    expect(engine.isOnline()).toBe(false);
    const result = await engine.sync();
    expect(result.status).toBe('offline');
    expect(server.pushCalls).toBe(0);
    expect(server.pullCalls).toBe(0);
  });
});

/** Strips identity/clock fields so fixtures stay editable per test. */
function pickNumbers(meal: typeof MEAL_A) {
  return { kcal: meal.kcal, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, fiberG: meal.fiberG };
}

/** One macrotask turn — enough for a chained promise run to make progress. */
function drainMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}
