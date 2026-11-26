import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

import type { PullResponse, PushResponse, SyncOperation } from '@coachcal/api-contract';

import { createApp } from './app';
import { createPgliteStore } from './store.pglite';

const SCHEMA_SQL = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');

const USER_1 = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';
const TOKEN_1 = 'spike-dev-token';
const TOKEN_2 = 'spike-dev-token-2';

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

const MEAL_C = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  eatenAt: '2026-11-27T05:40:00.000Z',
  name: 'Chicken rice bowl',
  kcal: 624,
  proteinG: 38,
  carbsG: 70,
  fatG: 18,
  fiberG: 4,
  updatedAt: 1_764_210_000_000,
};

let opCounter = 0;
const opId = () => `4ef2890a-1a2b-43c4-85d4-${String(++opCounter).padStart(12, '0')}`;

const upsertOp = (meal: typeof MEAL_A, overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  opId: opId(),
  recordId: meal.id,
  kind: 'upsert',
  meal,
  clientTimestamp: meal.updatedAt,
  ...overrides,
});

const tombstoneOp = (recordId: string, clientTimestamp: number): SyncOperation => ({
  opId: opId(),
  recordId,
  kind: 'tombstone',
  clientTimestamp,
});

type TestApp = Awaited<ReturnType<typeof makeApp>>;

/** Every PGlite instance this suite boots; closed after each test so Jest can exit. */
const openDbs: PGlite[] = [];

async function makeApp() {
  const db = new PGlite();
  openDbs.push(db);
  await db.exec(SCHEMA_SQL);
  const store = createPgliteStore(db);
  const app = createApp({ store, tokens: { [TOKEN_1]: USER_1, [TOKEN_2]: USER_2 } });
  return { db, app };
}

afterEach(async () => {
  const dbs = openDbs.splice(0);
  for (const db of dbs) {
    await db.close().catch(() => undefined);
  }
});

const post = async (app: TestApp['app'], url: string, token: string, body: unknown): Promise<Response> =>
  app.request(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const push = (app: TestApp['app'], operations: SyncOperation[], token = TOKEN_1) =>
  post(app, '/v1/sync/push', token, { operations }).then((res) => res.json() as Promise<PushResponse>);

const pull = async (app: TestApp['app'], cursor: number, token = TOKEN_1, limit?: number) => {
  const res = await post(app, '/v1/sync/pull', token, { cursor, ...(limit === undefined ? {} : { limit }) });
  return (await res.json()) as PullResponse;
};

const pullStatus = async (app: TestApp['app'], cursor: number, token = TOKEN_1) => {
  const res = await post(app, '/v1/sync/pull', token, { cursor });
  return res.status;
};

/** Test helpers that fail loudly on a missing item (keeps `noUncheckedIndexedAccess` happy). */
const acceptedAt = (res: PushResponse, index = 0) => {
  const item = res.accepted[index];
  if (item === undefined) throw new Error(`expected a push acknowledgement at index ${index}`);
  return item;
};

const rowAt = (res: PullResponse, index = 0) => {
  const row = res.rows[index];
  if (row === undefined) throw new Error(`expected a pull row at index ${index}`);
  return row;
};

describe('GET /health', () => {
  it('answers with ok', async () => {
    const { app } = await makeApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'coachcal-rn-spike-api' });
  });
});

describe('POST /v1/sync/push and pull', () => {
  it('applies an upsert and returns it on pull with the server record', async () => {
    const { app } = await makeApp();
    const op = upsertOp(MEAL_A);
    const pushRes = await push(app, [op]);
    expect(pushRes.accepted).toHaveLength(1);
    expect(acceptedAt(pushRes)).toMatchObject({
      opId: op.opId,
      status: 'applied',
      record: { ...MEAL_A, deleted: false, serverVersion: 1, acceptedOpId: op.opId },
    });

    const pullRes = await pull(app, 0);
    expect(pullRes.rows).toHaveLength(1);
    expect(rowAt(pullRes)).toEqual({ seq: 1, record: acceptedAt(pushRes).record });
    expect(pullRes.cursor).toBe(1);
    expect(pullRes.hasMore).toBe(false);
  });

  it('answers duplicate for a seen opId and writes nothing new', async () => {
    const { app } = await makeApp();
    const op = upsertOp(MEAL_A);
    await push(app, [op]);
    const first = await pull(app, 0);

    const replay = await push(app, [op]);
    expect(acceptedAt(replay).status).toBe('duplicate');
    expect(acceptedAt(replay).record).toEqual(rowAt(first).record);

    const second = await pull(app, first.cursor);
    expect(second.rows).toHaveLength(0);
  });

  it('does not overwrite with an older upsert but still answers applied with the current record', async () => {
    const { app } = await makeApp();
    const newer = upsertOp({ ...MEAL_A, name: 'Overnight oats v2', updatedAt: 2_000 });
    await push(app, [newer]);

    const older = upsertOp({ ...MEAL_A, name: 'Overnight oats v1', updatedAt: 1_000 });
    const res = await push(app, [older]);
    expect(acceptedAt(res).status).toBe('applied');
    expect(acceptedAt(res).record.name).toBe('Overnight oats v2');

    const pullRes = await pull(app, 0);
    expect(pullRes.rows).toHaveLength(1);
    expect(rowAt(pullRes).record.name).toBe('Overnight oats v2');
  });

  it('a newer upsert after a tombstone wins; an older upsert loses', async () => {
    const { app } = await makeApp();
    await push(app, [upsertOp(MEAL_A)]);

    // Tombstone at t=3000 wins over the stored row (updatedAt 1.7642e12? no —
    // these ops use small clocks on purpose; the stored row now has updatedAt 1764200400000,
    // so t=3000 is older and must lose).
    const loseOp = tombstoneOp(MEAL_A.id, 3_000);
    const lost = await push(app, [loseOp]);
    expect(acceptedAt(lost).record.deleted).toBe(false);

    const winOp = tombstoneOp(MEAL_A.id, 1_764_200_400_000);
    const won = await push(app, [winOp]);
    expect(acceptedAt(won).status).toBe('applied');
    expect(acceptedAt(won).record.deleted).toBe(true);

    // A newer edit revives the record after the tombstone.
    const revive = upsertOp({ ...MEAL_A, name: 'Revived oats', updatedAt: 1_764_200_450_000 });
    const revived = await push(app, [revive]);
    expect(acceptedAt(revived).record.deleted).toBe(false);
    expect(acceptedAt(revived).record.name).toBe('Revived oats');
  });

  it('pages pull results and reports hasMore only when more rows exist', async () => {
    const { app } = await makeApp();
    await push(app, [upsertOp(MEAL_A), upsertOp(MEAL_C)]);

    const page1 = await pull(app, 0, TOKEN_1, 1);
    expect(page1.rows).toHaveLength(1);
    expect(page1.hasMore).toBe(true);
    expect(page1.cursor).toBe(rowAt(page1).seq);

    const page2 = await pull(app, page1.cursor, TOKEN_1, 1);
    expect(page2.rows).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
    expect(page2.cursor).toBe(2);

    const beyond = await pull(app, 2);
    expect(beyond.rows).toHaveLength(0);
    expect(beyond.hasMore).toBe(false);
    expect(beyond.cursor).toBe(2);
  });

  it('isolates users: user 2 never sees user 1 rows', async () => {
    const { app } = await makeApp();
    await push(app, [upsertOp(MEAL_A), upsertOp(MEAL_C)]);

    const theirs = await pull(app, 0, TOKEN_2);
    expect(theirs.rows).toHaveLength(0);
    expect(theirs.hasMore).toBe(false);

    // And user 2 pushing its own copy of meal A does not touch user 1's row.
    const mine = await push(app, [upsertOp({ ...MEAL_A, name: 'User 2 oats' })], TOKEN_2);
    expect(acceptedAt(mine).record.serverVersion).toBe(1);
    const mine1 = await pull(app, 0, TOKEN_1);
    expect(rowAt(mine1).record.name).toBe('Overnight oats');
  });

  it('returns 400 INVALID_REQUEST for an unknown key and for an empty batch', async () => {
    const { app } = await makeApp();
    const unknownKey = await post(app, '/v1/sync/push', TOKEN_1, { operations: [], deviceId: 'x' });
    expect(unknownKey.status).toBe(400);
    const errBody = (await unknownKey.json()) as { error: { code: string; details: unknown[] } };
    expect(errBody.error.code).toBe('INVALID_REQUEST');
    expect(Array.isArray(errBody.error.details)).toBe(true);

    const empty = await post(app, '/v1/sync/push', TOKEN_1, { operations: [] });
    expect(empty.status).toBe(400);

    const badCursor = await post(app, '/v1/sync/pull', TOKEN_1, { cursor: -1 });
    expect(badCursor.status).toBe(400);

    const malformed = await post(app, '/v1/sync/push', TOKEN_1, 'not json');
    expect(malformed.status).toBe(400);
  });

  it('returns 401 UNAUTHORIZED on a missing or unknown token', async () => {
    const { app } = await makeApp();
    const missing = await app.request('/v1/sync/pull', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cursor: 0 }),
    });
    expect(missing.status).toBe(401);
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(missingBody.error.code).toBe('UNAUTHORIZED');

    const unknown = await pullStatus(app, 0, 'nope');
    expect(unknown).toBe(401);
  });

  it('answers a tombstone for a never-seen record with a deleted record', async () => {
    const { app } = await makeApp();
    const op = tombstoneOp('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1_764_220_000_000);
    const res = await push(app, [op]);
    expect(acceptedAt(res).status).toBe('applied');
    expect(acceptedAt(res).record.deleted).toBe(true);

    const pullRes = await pull(app, 0);
    expect(pullRes.rows).toHaveLength(1);
    expect(rowAt(pullRes).record.deleted).toBe(true);
  });

  it('returns a uniform error envelope for a malformed JSON body', async () => {
    const { app } = await makeApp();
    const res = await app.request('/v1/sync/pull', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN_1}`, 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});
