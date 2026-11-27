/**
 * The SQLite sync store on a real sql.js database (unit U-23, section B): a push acknowledgement
 * applies the record the server returns, and the mirror rows carry the session's user id.
 */
import type { Meal, MealRecord, SyncOperation } from '@coachcal/api-contract';

import { createRepoFixture, type RepoFixture } from '../repos/testing/fixtures';
import { createSqliteSyncStore, LOCAL_OWNER_ID } from './store.sqlite';

const RECORD_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const OP_1 = '11111111-1111-4111-8111-111111111111';
const OP_2 = '22222222-2222-4222-8222-222222222222';
const OP_WINNER = '99999999-9999-4999-8999-999999999999';
const T0 = 1_768_300_000_000;

function meal(name: string, kcal: number, updatedAt: number): Meal {
  return {
    id: RECORD_ID,
    eatenAt: '2026-11-27T08:00:00.000Z',
    name,
    kcal,
    proteinG: 10,
    carbsG: 20,
    fatG: 5,
    fiberG: 2,
    updatedAt,
  };
}

function upsertOp(opId: string, m: Meal): SyncOperation {
  return { opId, recordId: m.id, kind: 'upsert', clientTimestamp: m.updatedAt, meal: m };
}

function tombstoneOp(opId: string, at: number): SyncOperation {
  return { opId, recordId: RECORD_ID, kind: 'tombstone', clientTimestamp: at };
}

function record(m: Meal, extras: { serverVersion: number; acceptedOpId: string; deleted?: boolean }): MealRecord {
  return { ...m, deleted: extras.deleted ?? false, serverVersion: extras.serverVersion, acceptedOpId: extras.acceptedOpId };
}

async function setup(ownerId?: () => string) {
  const fixture: RepoFixture = await createRepoFixture();
  const store = createSqliteSyncStore(fixture.db, ownerId === undefined ? {} : { ownerId });
  return { fixture, store };
}

function mirrorOwners(fixture: RepoFixture): string[] {
  const result = fixture.client.exec('SELECT user_id FROM diary_entries');
  return (result[0]?.values ?? []).map((row) => String(row[0]));
}

describe('sqlite sync store: push acknowledgements apply the returned record', () => {
  it('a winning ack keeps the local content and stamps the version', async () => {
    const { store } = await setup();
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));

    await store.applyPushAcks([{ op: upsertOp(OP_1, mine), record: record(mine, { serverVersion: 3, acceptedOpId: OP_1 }) }]);

    const stored = await store.getMeal(RECORD_ID);
    expect(stored).toMatchObject({ name: 'My lunch', kcal: 500, serverVersion: 3, acceptedOpId: OP_1, deleted: false });
    expect(await store.outboxCount()).toBe(0);
  });

  it('a losing upsert ack applies the server record', async () => {
    const { store } = await setup();
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));
    const winner = meal('Other device lunch', 640, T0 + 5_000);

    await store.applyPushAcks([{ op: upsertOp(OP_1, mine), record: record(winner, { serverVersion: 4, acceptedOpId: OP_WINNER }) }]);

    const stored = await store.getMeal(RECORD_ID);
    expect(stored).toMatchObject({ name: 'Other device lunch', kcal: 640, serverVersion: 4, acceptedOpId: OP_WINNER, deleted: false });
    expect(await store.outboxCount()).toBe(0);
    expect(await store.hasPendingIntent(RECORD_ID)).toBe(false);
  });

  it('a losing ack applies the server record even when its version is not newer than the mirror', async () => {
    const { store } = await setup();
    // The mirror already holds version 4 of the winner...
    const winner = meal('Other device lunch', 640, T0 + 5_000);
    await store.applyPullPage(
      [{ seq: 4, record: record(winner, { serverVersion: 4, acceptedOpId: OP_WINNER }) }],
      4,
    );
    // ...then an offline edit with an older clock loses against that same record.
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));

    await store.applyPushAcks([{ op: upsertOp(OP_1, mine), record: record(winner, { serverVersion: 4, acceptedOpId: OP_WINNER }) }]);

    expect(await store.getMeal(RECORD_ID)).toMatchObject({ name: 'Other device lunch', kcal: 640, serverVersion: 4 });
  });

  it('a losing tombstone ack restores the live record', async () => {
    const { store } = await setup();
    const winner = meal('Kept lunch', 640, T0 + 5_000);
    await store.applyPullPage([{ seq: 2, record: record(winner, { serverVersion: 2, acceptedOpId: OP_WINNER }) }], 2);
    await store.recordDelete(RECORD_ID, tombstoneOp(OP_1, T0));
    expect((await store.getMeal(RECORD_ID))?.deleted).toBe(true);

    const newer = meal('Kept lunch edited', 700, T0 + 9_000);
    await store.applyPushAcks([{ op: tombstoneOp(OP_1, T0), record: record(newer, { serverVersion: 5, acceptedOpId: OP_2 }) }]);

    expect(await store.getMeal(RECORD_ID)).toMatchObject({
      name: 'Kept lunch edited',
      kcal: 700,
      deleted: false,
      serverVersion: 5,
      acceptedOpId: OP_2,
    });
    expect(await store.outboxCount()).toBe(0);
  });

  it('an ack with a newer pending op leaves the mirror alone', async () => {
    const { store } = await setup();
    const first = meal('First text', 400, T0);
    await store.recordUpsert(first, upsertOp(OP_1, first));
    const second = meal('Second text', 450, T0 + 2_000);
    await store.recordUpsert(second, upsertOp(OP_2, second));
    const winner = meal('Other device text', 640, T0 + 1_000);

    await store.applyPushAcks([{ op: upsertOp(OP_1, first), record: record(winner, { serverVersion: 7, acceptedOpId: OP_WINNER }) }]);

    expect(await store.getMeal(RECORD_ID)).toMatchObject({ name: 'Second text', kcal: 450, serverVersion: 0, acceptedOpId: null });
    const pending = await store.pendingOperations(10);
    expect(pending.map((entry) => entry.op.opId)).toEqual([OP_2]);
  });

  it('an ack for an op that is not in the outbox changes nothing', async () => {
    const { store } = await setup();
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));

    await store.applyPushAcks([
      { op: upsertOp(OP_2, mine), record: record(meal('Stranger', 1, T0 + 1), { serverVersion: 9, acceptedOpId: OP_2 }) },
    ]);

    expect(await store.getMeal(RECORD_ID)).toMatchObject({ name: 'My lunch', serverVersion: 0 });
    expect(await store.outboxCount()).toBe(1);
  });
});

describe('sqlite sync store: the session user owns the mirror rows', () => {
  it('writes and pulls carry the owner the runtime reads at write time', async () => {
    let owner = 'aaaaaaaa-0000-4000-8000-00000000000a';
    const { fixture, store } = await setup(() => owner);
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));
    owner = 'bbbbbbbb-0000-4000-8000-00000000000b';
    const other = { ...meal('Pulled', 100, T0), id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002' };
    await store.applyPullPage([{ seq: 1, record: record(other, { serverVersion: 1, acceptedOpId: OP_WINNER }) }], 1);

    expect(mirrorOwners(fixture).sort()).toEqual(['aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b']);
  });

  it('falls back to the demo owner when no session user is given (fixture and debug mode)', async () => {
    const { fixture, store } = await setup();
    const mine = meal('My lunch', 500, T0);
    await store.recordUpsert(mine, upsertOp(OP_1, mine));
    expect(mirrorOwners(fixture)).toEqual([LOCAL_OWNER_ID]);
  });
});
