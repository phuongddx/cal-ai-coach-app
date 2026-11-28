/**
 * The undo of the diary (the delete's and the edit's) through the real sync
 * engine against the fake server (the D4 rules: an upsert wins only with a
 * later `updatedAt`; a tombstone is stored with its own time). The review's
 * second correction, T1 to T4: after the undo the record is never left with
 * zero pending ops and the restored entry carries the undo's time, so the
 * server tombstone can never out-argue it.
 */
import { eq } from 'drizzle-orm';

import { createSyncEngine } from './engine';
import { FakeServer } from './fakeServer';
import { createSqliteSyncStore } from './store.sqlite';
import { countRows, createDiaryEntryRepository, fetchDiaryEntry, fetchDiaryEntryDetail, type DiaryEntryDetail } from '../repos/diaryEntryRepository';
import { createDiaryDetailRepository } from '../repos/diaryDetailRepository';
import { createCatalogRepository } from '../repos/catalogRepository';
import { createTargetRepository } from '../repos/targetRepository';
import { createTrackingRepository } from '../repos/trackingRepository';
import { createRepoFixture, type RepoFixture } from '../repos/testing/fixtures';
import { diaryEntries, pendingOps } from '../db/schema';
import { createDiaryDayModel } from '../../features/diary/diaryDayModel';
import type { DiaryDeps } from '../../features/diary/deps';
import type { SyncTransport } from './types';

const USER_ID = '00000000-0000-4000-8000-000000000001';

type Harness = {
  fixture: RepoFixture;
  server: FakeServer;
  deps: DiaryDeps;
  model: ReturnType<typeof createDiaryDayModel>;
  dispatch: () => Promise<void>;
  holdNextPush: () => void;
  releaseIfHeld: () => void;
};

async function makeHarness(): Promise<Harness> {
  const fixture = await createRepoFixture();
  const server = new FakeServer();
  let release: (() => void) | null = null;
  let held: Promise<void> | null = null;

  /** Wraps the fake server so a test can hold the next push (the in-flight case). */
  const transport: SyncTransport = {
    push: async (operations) => {
      if (held !== null) await held;
      return server.push(operations);
    },
    pull: async (cursor) => server.pull(cursor, 50),
  };

  const store = createSqliteSyncStore(fixture.db);
  const engine = createSyncEngine({
    store,
    transport,
    now: () => fixture.clock().getTime(),
    isOnline: () => true,
    schedule: () => undefined,
  });

  const deps: DiaryDeps = {
    db: fixture.db,
    catalog: createCatalogRepository(fixture.db),
    diaryEntries: createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock }),
    diaryDetails: createDiaryDetailRepository(fixture.db),
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    notify: () => undefined,
    ownerId: USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
  const model = createDiaryDayModel(deps, fixture.clock());
  await model.refresh();

  return {
    fixture,
    server,
    deps,
    model,
    async dispatch() {
      await engine.bind(fixture.newId());
      await engine.dispatch();
    },
    holdNextPush() {
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    releaseIfHeld() {
      release?.();
      release = null;
      held = null;
    },
  };
}

/** Seeds one live entry with a detail that carries every local-only field. */
async function seedEntry(harness: Harness, title: string): Promise<DiaryEntryDetail> {
  const clock = harness.fixture.clock();
  const detail: DiaryEntryDetail = {
    entryId: harness.fixture.newId(),
    mealSlot: 'dinner',
    title,
    grams: 350,
    kcal: 543,
    proteinG: 20,
    carbsG: 60,
    fatG: 15,
    fiberG: 4,
    confidence: 0.61,
    hiddenFatLikely: false,
    source: 'scan',
    unresolved: false,
    scanId: 'scan-1',
  };
  await harness.fixture.db.insert(diaryEntries).values({
    id: detail.entryId,
    userId: USER_ID,
    displayText: detail.title,
    createdAt: clock.toISOString(),
    updatedAt: clock.toISOString(),
    deletedAt: null,
    serverVersion: 0,
    acceptedOpId: null,
    serverUpdatedAt: clock.toISOString(),
  });
  await harness.deps.diaryDetails.upsert(detail);
  await harness.model.refresh();
  return detail;
}

describe('the diary undo through the sync engine (the second correction, T1 to T4)', () => {
  // T1, after the ack: the delete's tombstone is on the server and the local
  // op is gone. The undo must re-record with the undo's time so the upsert
  // beats the tombstone — the entry survives push, ack, pull.
  it('T1 an undo after the delete is acknowledged: the server keeps the entry with the undo time and a further pull changes nothing', async () => {
    const harness = await makeHarness();
    const undoMs = harness.fixture.clock().getTime() + 1;
    const detail = await seedEntry(harness, 'Spaghetti Bolognese');
    const item = harness.model.items('dinner')[0];
    expect(item?.id).toBe(detail.entryId);

    await harness.model.delete(item);
    await harness.dispatch(); // the server holds the tombstone; the local op is acked away

    await harness.model.undoDelete(item);
    await harness.dispatch(); // pushes the undo's upsert; the server applies it over the tombstone

    const serverRecord = harness.server.records.get(detail.entryId);
    expect(serverRecord?.deleted).toBe(false);
    expect(serverRecord?.updatedAt).toBe(undoMs);
    const entry = await fetchDiaryEntry(harness.deps.db, detail.entryId);
    expect(entry?.deletedAt).toBeNull();
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(0);

    // A further pull changes nothing: the row keeps the undo's state.
    await harness.dispatch();
    const entryAfterPull = await fetchDiaryEntry(harness.deps.db, detail.entryId);
    expect(entryAfterPull?.updatedAt).toEqual(entry?.updatedAt);
    expect(entryAfterPull?.deletedAt).toBeNull();
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(0);
    expect(harness.server.records.get(detail.entryId)?.deleted).toBe(false);
  }, 30_000);

  // T2, in flight: the engine has read the tombstone op and its push is held
  // when the undo runs. The record must never sit with zero ops; the next
  // dispatch leaves the server with the upsert.
  it('T2 an undo while the delete push is in flight: exactly one pending op survives and the next dispatch leaves the server with the upsert', async () => {
    const harness = await makeHarness();
    const undoMs = harness.fixture.clock().getTime() + 1;
    const detail = await seedEntry(harness, 'Spaghetti Bolognese');
    const item = harness.model.items('dinner')[0];

    await harness.model.delete(item);
    harness.holdNextPush();
    const dispatching = harness.dispatch(); // the engine reads the tombstone op; the push waits

    await harness.model.undoDelete(item);
    harness.releaseIfHeld();
    await dispatching;

    // The restored row exists with exactly one pending op — never zero.
    const entry = await fetchDiaryEntry(harness.deps.db, detail.entryId);
    expect(entry?.deletedAt).toBeNull();
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(1);
    const ops = await harness.deps.db.select({ kind: pendingOps.kind }).from(pendingOps);
    expect(ops.map((op) => op.kind)).toEqual(['upsert']);

    await harness.dispatch(); // the next dispatch leaves the server with the upsert
    const serverRecord = harness.server.records.get(detail.entryId);
    expect(serverRecord?.deleted).toBe(false);
    expect(serverRecord?.updatedAt).toBe(undoMs);
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(0);
    expect((await fetchDiaryEntry(harness.deps.db, detail.entryId))?.deletedAt).toBeNull();
  }, 30_000);

  // T3, the edit's undo after the edit was acknowledged: the previous grams
  // and kcal come back and the detail keeps its local-only fields.
  it('T3 the edit undo after the edit is acknowledged: the previous grams and kcal return and the detail keeps its fields', async () => {
    const harness = await makeHarness();
    const undoMs = harness.fixture.clock().getTime() + 1;
    const detail = await seedEntry(harness, 'Spaghetti Bolognese');
    const item = harness.model.items('dinner')[0];

    await harness.model.updateEntry(item, 300); // the edit: grams 300, kcal recomputed
    await harness.dispatch(); // the server holds the edited record; the edit's op is acked away

    await harness.model.writeEntry(item.entry, item.detail); // the edit's undo restores the previous entry
    await harness.dispatch();

    const serverRecord = harness.server.records.get(detail.entryId);
    expect(serverRecord?.deleted).toBe(false);
    expect(serverRecord?.updatedAt).toBe(undoMs);
    const stored = await fetchDiaryEntryDetail(harness.deps.db, detail.entryId);
    expect(stored?.grams).toBe(350);
    expect(stored?.kcal).toBe(543);
    expect(stored?.confidence).toBe(0.61);
    expect(stored?.source).toBe('scan');
    expect(stored?.scanId).toBe('scan-1');
  }, 30_000);

  // T4, the edit's undo before the edit's op is taken: one op travels, the
  // previous grams and kcal, and the detail keeps its fields.
  it('T4 the edit undo before the edit op is taken: one op travels with the previous grams and kcal and the detail keeps its fields', async () => {
    const harness = await makeHarness();
    const undoMs = harness.fixture.clock().getTime() + 1;
    const detail = await seedEntry(harness, 'Spaghetti Bolognese');
    const item = harness.model.items('dinner')[0];

    await harness.model.updateEntry(item, 300); // the edit's op waits in the outbox
    await harness.model.writeEntry(item.entry, item.detail); // the undo replaces it before the take
    await harness.dispatch();

    const serverRecord = harness.server.records.get(detail.entryId);
    expect(serverRecord?.deleted).toBe(false);
    expect(serverRecord?.kcal).toBe(543);
    expect(await countRows(harness.deps.db, 'pending_ops')).toBe(0);
    const stored = await fetchDiaryEntryDetail(harness.deps.db, detail.entryId);
    expect(stored?.grams).toBe(350);
    expect(stored?.kcal).toBe(543);
    expect(stored?.confidence).toBe(0.61);
    expect(stored?.source).toBe('scan');
    expect(stored?.scanId).toBe('scan-1');
  }, 30_000);
});
