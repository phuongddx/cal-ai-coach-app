/**
 * U-85: an entry written twice before the dispatch that carries the first keeps the local fields of its
 * detail row (grams, confidence, source, scan id). The scenarios go through the real engine, the real
 * SQLite sync store (sql.js) and the fake server, which applies the rule of the API (`wins()` in
 * `apps/api/src/sync.ts`): the writes go through the diary repository, as the scan save and the diary
 * edits do.
 *
 * Two more cases pin what the fix must not change: a pulled row never overwrites a row with a pending
 * local intent, and an operation that loses against ANOTHER device still mirrors the winner.
 */
import { eq } from 'drizzle-orm';

import type { SyncOperation } from '@coachcal/api-contract';

import { diaryEntryDetails, pendingOps } from '../db/schema';
import {
  createDiaryEntryRepository,
  fetchDiaryEntry,
  fetchDiaryEntryDetail,
  type DiaryEntry,
  type DiaryEntryDetail,
} from '../repos/diaryEntryRepository';
import { createRepoFixture, FIXED_NOW_MS } from '../repos/testing/fixtures';
import { createSyncEngine } from './engine';
import { FakeServer } from './fakeServer';
import { createSqliteSyncStore } from './store.sqlite';
import { SyncError, type SyncTransport } from './types';

const T0 = FIXED_NOW_MS;
const ENTRY_ID = 'e0000000-0000-4000-8000-000000000001';
const SCAN_ID = '5ca00000-0000-4000-8000-000000000001';
const OWNER = 'de000000-0000-4000-8000-000000000001';
const OTHER_DEVICE_OP = 'd0000000-0000-4000-8000-0000000000aa';

function entryAt(displayText: string, atMs: number, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: ENTRY_ID,
    userId: OWNER,
    displayText,
    createdAt: new Date(T0),
    updatedAt: new Date(atMs),
    deletedAt: null,
    serverVersion: 0,
    acceptedOpId: null,
    serverUpdatedAt: new Date(atMs),
    ...overrides,
  };
}

/** A scanned entry's detail: the fields the wire does not carry (grams, confidence, source, scan id). */
function scannedDetail(title: string, grams: number, kcal: number): DiaryEntryDetail {
  return {
    entryId: ENTRY_ID,
    mealSlot: 'lunch',
    title,
    grams,
    kcal,
    proteinG: 30,
    carbsG: 40,
    fatG: 10,
    fiberG: 4,
    confidence: 0.82,
    hiddenFatLikely: true,
    source: 'scan',
    unresolved: false,
    scanId: SCAN_ID,
  };
}

async function setup() {
  const fixture = await createRepoFixture();
  const store = createSqliteSyncStore(fixture.db);
  const server = new FakeServer();
  let transport: SyncTransport = server;
  const engine = createSyncEngine({
    store,
    transport: { push: (ops) => transport.push(ops), pull: (cursor, limit) => transport.pull(cursor, limit) },
    now: () => fixture.clock().getTime(),
    isOnline: () => true,
    schedule: () => undefined,
  });
  await engine.bind(OWNER);
  const entries = createDiaryEntryRepository(fixture.db, { newId: fixture.newId, now: fixture.clock });

  /** A local write of the entry and its detail at `atMs` (the scan save and the edits of the diary). */
  const write = async (displayText: string, atMs: number, detail: DiaryEntryDetail): Promise<void> => {
    fixture.setClock(atMs);
    await entries.recordUpserts([{ entry: entryAt(displayText, atMs), detail }], new Date(atMs));
  };
  const remove = async (atMs: number): Promise<void> => {
    fixture.setClock(atMs);
    const entry = await fetchDiaryEntry(fixture.db, ENTRY_ID);
    await entries.recordTombstone(entry!, { now: new Date(atMs) });
    await fixture.db.delete(diaryEntryDetails).where(eq(diaryEntryDetails.entryId, ENTRY_ID)); // as the diary does
  };
  const pendingIds = async (): Promise<string[]> =>
    (await fixture.db.select({ opId: pendingOps.opId }).from(pendingOps)).map((row) => row.opId);

  return {
    fixture,
    store,
    server,
    engine,
    write,
    remove,
    pendingIds,
    setTransport: (next: SyncTransport) => {
      transport = next;
    },
  };
}

describe('U-85: the local fields of an entry written twice before its dispatch survive the acknowledgement', () => {
  it('an entry edited twice before its first dispatch shows the second edit and keeps its grams, confidence, source and scan id', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    await t.write('Chicken bowl, large', T0 + 100, scannedDetail('Chicken bowl, large', 180, 360));

    await t.engine.dispatch();

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Chicken bowl, large', kcal: 360, deleted: false });
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Chicken bowl, large', deletedAt: null });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({
      grams: 180,
      kcal: 360,
      confidence: 0.82,
      source: 'scan',
      scanId: SCAN_ID,
    });
  });

  it('an entry logged and then edited while the transport fails shows the edit and keeps its local fields after the next dispatch succeeds', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    await t.write('Chicken bowl, large', T0 + 100, scannedDetail('Chicken bowl, large', 180, 360));
    t.server.pushError = new SyncError('offline', 'the device is offline');

    await expect(t.engine.dispatch()).rejects.toBeInstanceOf(SyncError);
    expect(await t.pendingIds()).toHaveLength(2); // nothing was lost while offline
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ grams: 180, source: 'scan' });

    t.fixture.setClock(T0 + 60_000); // past the backoff of the failed attempt
    await t.engine.dispatch();

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Chicken bowl, large', kcal: 360, deleted: false });
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Chicken bowl, large' });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({
      grams: 180,
      kcal: 360,
      confidence: 0.82,
      source: 'scan',
      scanId: SCAN_ID,
    });
  });

  it('an entry edited and then deleted before the dispatch leaves a tombstone on the server, a tombstoned local row, no op and no error', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    await t.write('Chicken bowl, large', T0 + 100, scannedDetail('Chicken bowl, large', 180, 360));
    await t.remove(T0 + 200);

    const result = await t.engine.dispatch();

    expect(result.poisoned).toBe(0);
    expect(t.engine.lastResult().status).toBe('synced');
    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ deleted: true });
    const local = await fetchDiaryEntry(t.fixture.db, ENTRY_ID);
    expect(local?.deletedAt).not.toBeNull();
    expect(local?.serverVersion).toBe(t.server.records.get(ENTRY_ID)?.serverVersion);
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toBeNull();
  });

  it('an entry deleted and logged again with the same id after its first dispatch is on the server and local as the last write left it', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    await t.engine.dispatch();
    await t.remove(T0 + 1_000); // the delete
    await t.write('Salad', T0 + 2_000, scannedDetail('Salad', 220, 180)); // the undo logs it again under the same id

    await t.engine.dispatch();

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Salad', kcal: 180, deleted: false, updatedAt: T0 + 2_000 });
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Salad', deletedAt: null });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ grams: 220, kcal: 180, confidence: 0.82, source: 'scan', scanId: SCAN_ID });
  });

  it('an entry logged, deleted and logged again with the same id before any dispatch is on the server and local as the last write left it', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    await t.remove(T0 + 1_000);
    await t.write('Salad', T0 + 2_000, scannedDetail('Salad', 220, 180));

    await t.engine.dispatch();

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Salad', kcal: 180, deleted: false });
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Salad', deletedAt: null });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ grams: 220, kcal: 180, confidence: 0.82, source: 'scan', scanId: SCAN_ID });
  });
});

describe('U-85: what the fix must not change', () => {
  it('a pulled row never overwrites a row with a pending local intent', async () => {
    const t = await setup();
    await t.write('Chicken bowl', T0, scannedDetail('Chicken bowl', 150, 300));
    // The user edits again while the push of the first write is in flight: the pull of the same dispatch
    // delivers the first write's record, and the edit's op is still pending.
    const racing: SyncTransport = {
      push: async (ops: SyncOperation[]) => {
        const response = await t.server.push(ops);
        await t.write('Chicken bowl, large', T0 + 500, scannedDetail('Chicken bowl, large', 180, 360));
        return response;
      },
      pull: (cursor, limit) => t.server.pull(cursor, limit),
    };
    t.setTransport(racing);
    t.fixture.setClock(T0 + 10);

    await t.engine.dispatch();

    expect(await t.pendingIds()).toHaveLength(1); // the edit waits for its own dispatch
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Chicken bowl, large' });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ grams: 180, kcal: 360, confidence: 0.82, source: 'scan', scanId: SCAN_ID });

    t.setTransport(t.server);
    await t.engine.dispatch(); // the edit wins on the server and keeps its local fields

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Chicken bowl, large' });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ grams: 180, confidence: 0.82, source: 'scan', scanId: SCAN_ID });
  });

  it('an operation that loses against another device still mirrors the winner', async () => {
    const t = await setup();
    // This device holds the entry as it pulled it (version 1, text of device B).
    t.server.seed({
      id: ENTRY_ID,
      eatenAt: new Date(T0).toISOString(),
      name: 'Device B v1',
      kcal: 100,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
      fiberG: 1,
      updatedAt: T0,
      deleted: false,
      serverVersion: 1,
      acceptedOpId: OTHER_DEVICE_OP,
    });
    t.fixture.setClock(T0 + 10);
    await t.engine.dispatch(); // pulls version 1
    // Device B edits later (T0 + 5000) while this device edits offline at T0 + 1000.
    t.server.seed({
      id: ENTRY_ID,
      eatenAt: new Date(T0).toISOString(),
      name: 'Device B v2',
      kcal: 250,
      proteinG: 2,
      carbsG: 2,
      fatG: 2,
      fiberG: 2,
      updatedAt: T0 + 5_000,
      deleted: false,
      serverVersion: 2,
      acceptedOpId: OTHER_DEVICE_OP.replace('aa', 'bb'),
    });
    await t.write('My edit', T0 + 1_000, scannedDetail('My edit', 90, 200));

    await t.engine.dispatch();

    expect(await t.pendingIds()).toEqual([]);
    expect(t.server.records.get(ENTRY_ID)).toMatchObject({ name: 'Device B v2' }); // the server kept the winner
    expect(await fetchDiaryEntry(t.fixture.db, ENTRY_ID)).toMatchObject({ displayText: 'Device B v2', serverVersion: 2, deletedAt: null });
    expect(await fetchDiaryEntryDetail(t.fixture.db, ENTRY_ID)).toMatchObject({ kcal: 250, source: 'sync' });
  });
});
