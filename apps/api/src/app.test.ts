/**
 * The route tests of the HTTP surface. The first version of this file ran the sync routes against an
 * in-process PGlite; it now runs them against the real SQL functions (sync_push / sync_pull behind
 * the adapter in sync.ts) on the throwaway PostgreSQL 17, with real sessions. The sentences of the
 * eleven original tests are unchanged. Server versions are global counters now, so the assertions on
 * them are relative (the first push of a fresh user no longer gets version 1).
 */
import type { PullResponse, PushResponse, SyncOperation } from '@coachcal/api-contract';

import { describeSql, type Harness } from './testing/sqlHarness';

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


/** The users of one test: a real session each. */
async function twoUsers(h: Harness) {
  const one = await h.sessionUser();
  const two = await h.sessionUser();
  return { TOKEN_1: one.accessToken, TOKEN_2: two.accessToken, USER_1: one.userId, USER_2: two.userId };
}

const post = (h: Harness, url: string, token: string, body: unknown): Promise<Response> => h.post(url, body, token);

const push = (h: Harness, operations: SyncOperation[], token: string) =>
  post(h, '/v1/sync/push', token, { operations }).then((res) => res.json() as Promise<PushResponse>);

const pull = async (h: Harness, cursor: number, token: string, limit?: number) => {
  const res = await post(h, '/v1/sync/pull', token, { cursor, ...(limit === undefined ? {} : { limit }) });
  return (await res.json()) as PullResponse;
};

const pullStatus = async (h: Harness, cursor: number, token: string) => {
  const res = await post(h, '/v1/sync/pull', token, { cursor });
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

describeSql('HTTP routes against the real SQL functions', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  describe('GET /health', () => {
    it('answers with ok', async () => {
      const res = await harness().call('GET', '/health');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, service: 'coachcal-api' });
    });
  });

  describe('POST /v1/sync/push and pull', () => {
    it('applies an upsert and returns it on pull with the server record', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const op = upsertOp(MEAL_A);
      const pushRes = await push(h, [op], TOKEN_1);
      expect(pushRes.accepted).toHaveLength(1);
      expect(acceptedAt(pushRes)).toMatchObject({
        opId: op.opId,
        status: 'applied',
        record: { ...MEAL_A, deleted: false, acceptedOpId: op.opId },
      });
      const version = acceptedAt(pushRes).record.serverVersion;
      expect(version).toBeGreaterThan(0);

      const pullRes = await pull(h, 0, TOKEN_1);
      expect(pullRes.rows).toHaveLength(1);
      expect(rowAt(pullRes)).toEqual({ seq: version, record: acceptedAt(pushRes).record });
      expect(pullRes.cursor).toBe(version);
      expect(pullRes.hasMore).toBe(false);
    });

    it('answers duplicate for a seen opId and writes nothing new', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const op = upsertOp(MEAL_A);
      await push(h, [op], TOKEN_1);
      const first = await pull(h, 0, TOKEN_1);

      const replay = await push(h, [op], TOKEN_1);
      expect(acceptedAt(replay).status).toBe('duplicate');
      expect(acceptedAt(replay).record).toEqual(rowAt(first).record);

      const second = await pull(h, first.cursor, TOKEN_1);
      expect(second.rows).toHaveLength(0);
    });

    it('does not overwrite with an older upsert but still answers applied with the current record', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const newer = upsertOp({ ...MEAL_A, name: 'Overnight oats v2', updatedAt: 2_000 });
      await push(h, [newer], TOKEN_1);

      const older = upsertOp({ ...MEAL_A, name: 'Overnight oats v1', updatedAt: 1_000 });
      const res = await push(h, [older], TOKEN_1);
      expect(acceptedAt(res).status).toBe('applied');
      expect(acceptedAt(res).record.name).toBe('Overnight oats v2');

      const pullRes = await pull(h, 0, TOKEN_1);
      expect(pullRes.rows).toHaveLength(1);
      expect(rowAt(pullRes).record.name).toBe('Overnight oats v2');
    });

    it('a newer upsert after a tombstone wins; an older upsert loses', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      await push(h, [upsertOp(MEAL_A)], TOKEN_1);

      // The stored row has updatedAt 1764200400000, so a tombstone at t=3000 is older and must lose.
      const loseOp = tombstoneOp(MEAL_A.id, 3_000);
      const lost = await push(h, [loseOp], TOKEN_1);
      expect(acceptedAt(lost).record.deleted).toBe(false);

      const winOp = tombstoneOp(MEAL_A.id, 1_764_200_400_000);
      const won = await push(h, [winOp], TOKEN_1);
      expect(acceptedAt(won).status).toBe('applied');
      expect(acceptedAt(won).record.deleted).toBe(true);

      // A newer edit revives the record after the tombstone.
      const revive = upsertOp({ ...MEAL_A, name: 'Revived oats', updatedAt: 1_764_200_450_000 });
      const revived = await push(h, [revive], TOKEN_1);
      expect(acceptedAt(revived).record.deleted).toBe(false);
      expect(acceptedAt(revived).record.name).toBe('Revived oats');
    });

    it('pages pull results and reports hasMore only when more rows exist', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      await push(h, [upsertOp(MEAL_A), upsertOp(MEAL_C)], TOKEN_1);

      const page1 = await pull(h, 0, TOKEN_1, 1);
      expect(page1.rows).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBe(rowAt(page1).seq);

      const page2 = await pull(h, page1.cursor, TOKEN_1, 1);
      expect(page2.rows).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      expect(page2.cursor).toBe(rowAt(page2).seq);
      expect(page2.cursor).toBeGreaterThan(page1.cursor);

      const beyond = await pull(h, page2.cursor, TOKEN_1);
      expect(beyond.rows).toHaveLength(0);
      expect(beyond.hasMore).toBe(false);
      expect(beyond.cursor).toBe(page2.cursor);
    });

    it('isolates users: user 2 never sees user 1 rows', async () => {
      const h = harness();
      const { TOKEN_1, TOKEN_2 } = await twoUsers(h);
      await push(h, [upsertOp(MEAL_A), upsertOp(MEAL_C)], TOKEN_1);

      const theirs = await pull(h, 0, TOKEN_2);
      expect(theirs.rows).toHaveLength(0);
      expect(theirs.hasMore).toBe(false);

      // User 2 pushing its own record leaves user 1's rows untouched.
      const own = { ...MEAL_A, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'User 2 oats' };
      const mine = await push(h, [upsertOp(own)], TOKEN_2);
      expect(acceptedAt(mine).status).toBe('applied');
      expect(acceptedAt(mine).record.name).toBe('User 2 oats');
      const mine1 = await pull(h, 0, TOKEN_1);
      expect(mine1.rows).toHaveLength(2);
      expect(rowAt(mine1).record.name).toBe('Overnight oats');
    });

    it('denies a push that targets another user\'s record with 403 and leaves that row unchanged', async () => {
      const h = harness();
      const { TOKEN_1, TOKEN_2 } = await twoUsers(h);
      await push(h, [upsertOp(MEAL_A)], TOKEN_1);

      const attack = await post(h, '/v1/sync/push', TOKEN_2, {
        operations: [upsertOp({ ...MEAL_A, name: 'Hijacked', updatedAt: MEAL_A.updatedAt + 10_000 })],
      });
      expect(attack.status).toBe(403);
      expect(((await attack.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');

      const tombstone = await post(h, '/v1/sync/push', TOKEN_2, {
        operations: [tombstoneOp(MEAL_A.id, MEAL_A.updatedAt + 10_000)],
      });
      expect(tombstone.status).toBe(403);

      const stillMine = await pull(h, 0, TOKEN_1);
      expect(stillMine.rows).toHaveLength(1);
      expect(rowAt(stillMine).record).toMatchObject({ name: 'Overnight oats', deleted: false });
      expect((await pull(h, 0, TOKEN_2)).rows).toHaveLength(0);
    });

    it('returns 400 VALIDATION_ERROR for an unknown key and for an empty batch', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const unknownKey = await post(h, '/v1/sync/push', TOKEN_1, { operations: [], deviceId: 'x' });
      expect(unknownKey.status).toBe(400);
      const errBody = (await unknownKey.json()) as { error: { code: string; details: unknown[] } };
      expect(errBody.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(errBody.error.details)).toBe(true);

      const empty = await post(h, '/v1/sync/push', TOKEN_1, { operations: [] });
      expect(empty.status).toBe(400);

      const badCursor = await post(h, '/v1/sync/pull', TOKEN_1, { cursor: -1 });
      expect(badCursor.status).toBe(400);

      const malformed = await post(h, '/v1/sync/push', TOKEN_1, 'not json');
      expect(malformed.status).toBe(400);
    });

    it('returns 401 UNAUTHORIZED on a missing or unknown token', async () => {
      const h = harness();
      const missing = await h.post('/v1/sync/pull', { cursor: 0 });
      expect(missing.status).toBe(401);
      const missingBody = (await missing.json()) as { error: { code: string } };
      expect(missingBody.error.code).toBe('UNAUTHORIZED');

      const unknown = await pullStatus(h, 0, 'nope');
      expect(unknown).toBe(401);
    });

    it('answers a tombstone for a never-seen record with a deleted record', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const op = tombstoneOp('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1_764_220_000_000);
      const res = await push(h, [op], TOKEN_1);
      expect(acceptedAt(res).status).toBe('applied');
      expect(acceptedAt(res).record.deleted).toBe(true);

      const pullRes = await pull(h, 0, TOKEN_1);
      expect(pullRes.rows).toHaveLength(1);
      expect(rowAt(pullRes).record.deleted).toBe(true);
    });

    it('returns a uniform error envelope for a malformed JSON body', async () => {
      const h = harness();
      const { TOKEN_1 } = await twoUsers(h);
      const res = await h.post('/v1/sync/pull', 'not json', TOKEN_1);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
