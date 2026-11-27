/**
 * Section F of unit U-23: the real client engine and the real SQLite sync store (sql.js) against the
 * real API on port 8787 (PostgreSQL 17 behind it), two devices of one user.
 *
 * The API slot is held when `scripts/rn/start-api.sh` has written its env file for this checkout
 * (the same rule and file name as `apps/api/src/testing/sqlHarness.ts`). Without it the suite is
 * skipped with a loud console.warn: it never passes silently. With it, an unreachable API is a failure.
 *
 * Every scenario uses fresh record ids and compares whole stores only after both devices pulled
 * everything. The dev user's rows are deleted after the suite (through the owner role of the env file),
 * so `scripts/rn/e2e-sync.sh`, which expects an empty user 1, can run after `npm test` on the same cluster.
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { request } from 'node:http';
import { join, resolve } from 'node:path';

import type { PullResponse } from '@coachcal/api-contract';

import { createFetchSyncTransport } from '../api/syncClient';
import { createMealRepository, type MealInput, type MealRepository } from './repository';
import { createRepoFixture } from '../repos/testing/fixtures';
import { createSyncEngine, type SyncEngine } from './engine';
import { createSqliteSyncStore } from './store.sqlite';
import type { LocalMeal, SyncTransport } from './types';
import { newUuid } from './uuid';

/** The user behind the dev token `spike-dev-token` (apps/api/dev-tokens.json). */
const DEV_TOKEN = 'spike-dev-token';
const DEV_USER_ID = '11111111-1111-4111-8111-111111111111';

const repoRoot = realpathSync(resolve(__dirname, '..', '..', '..', '..', '..'));

/** A variable from the process environment or from the env file `scripts/rn/start-api.sh` wrote for this checkout. */
function apiEnv(name: string): string | null {
  if (process.env[name]) return process.env[name] as string;
  const key = createHash('sha256').update(repoRoot).digest('hex').slice(0, 12);
  const file = process.env.RN_API_ENV_FILE ?? join(process.env.TMPDIR ?? '/tmp', `coachcal-rn-api-${key}.env`);
  try {
    const match = new RegExp(`^\\s*(?:export\\s+)?${name}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'));
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const baseUrl = apiEnv('API_BASE_URL');

/**
 * `fetch` over node:http. Under jest-expo the global `fetch` is the React Native one, which has no
 * network in Jest (it answers without a status); the transport only reads `status` and `text()`.
 */
const nodeFetch = ((input: string, init?: RequestInit): Promise<Response> =>
  new Promise((resolvePromise, reject) => {
    const req = request(
      input,
      { method: init?.method ?? 'GET', headers: init?.headers as Record<string, string> | undefined },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          resolvePromise({ status, ok: status >= 200 && status < 300, text: async () => raw } as Response);
        });
      },
    );
    req.on('error', reject);
    if (typeof init?.body === 'string') req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;

if (baseUrl === null) {
  console.warn(
    '[api-skip] sync e2e integration suite skipped: no API env file for this checkout. ' +
      'Run `bash scripts/rn/start-api.sh` (the API slot) and re-run to execute it.',
  );
}

const describeApi = baseUrl === null ? describe.skip : describe;

type Device = {
  repo: MealRepository;
  engine: SyncEngine;
  /** Sets the wall clock of this device (the LWW clock of its edits). */
  setClock(ms: number): void;
  /** When set, the pull answers an empty page at the current cursor: only the push reaches the server. */
  skipPull: boolean;
  meals(): Promise<LocalMeal[]>;
};

async function makeDevice(url: string): Promise<Device> {
  const fixture = await createRepoFixture();
  const store = createSqliteSyncStore(fixture.db, { ownerId: () => DEV_USER_ID });
  const real = createFetchSyncTransport({ tokenProvider: async () => DEV_TOKEN, baseUrl: url, fetchImpl: nodeFetch });
  let clock = Date.now();
  const device: Device = {
    setClock: (ms) => {
      clock = ms;
    },
    skipPull: false,
    meals: () => store.listMeals(),
    repo: createMealRepository({ store, now: () => clock, newId: () => newUuid() }),
    engine: undefined as unknown as SyncEngine,
  };
  const transport: SyncTransport = {
    push: (operations) => real.push(operations),
    pull: async (cursor, limit): Promise<PullResponse> =>
      device.skipPull ? { rows: [], cursor, hasMore: false } : real.pull(cursor, limit),
  };
  device.engine = createSyncEngine({
    store,
    transport,
    now: () => Date.now(),
    isOnline: () => true,
    schedule: () => undefined,
  });
  await device.engine.bind(DEV_USER_ID);
  return device;
}

const MEAL: MealInput = { name: 'Overnight oats', kcal: 320, proteinG: 12, carbsG: 45, fatG: 9, fiberG: 6 };

/** What two converged stores must agree on, whatever their local clocks say. */
const shape = (meals: LocalMeal[]) =>
  meals
    .map((meal) => ({
      id: meal.id,
      name: meal.name,
      kcal: meal.kcal,
      deleted: meal.deleted,
      serverVersion: meal.serverVersion,
      acceptedOpId: meal.acceptedOpId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

describeApi('sync engine and SQLite store against the real API', () => {
  let a: Device;
  let b: Device;

  beforeAll(async () => {
    const health = await nodeFetch(`${baseUrl}/health`).catch(() => null);
    if (health === null || !health.ok) {
      throw new Error(`The API env file exists but ${baseUrl}/health does not answer: start it with scripts/rn/start-api.sh`);
    }
  });

  afterAll(async () => {
    const ownerUrl = apiEnv('TEST_OWNER_URL');
    if (ownerUrl === null) {
      console.warn('[api-skip] no TEST_OWNER_URL: the dev user rows of the sync e2e suite were not deleted');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require('postgres') as typeof import('postgres');
    const owner = postgres(ownerUrl, { max: 1 });
    try {
      await owner`DELETE FROM public.sync_operations WHERE user_id = ${DEV_USER_ID}::uuid`;
      await owner`DELETE FROM public.diary_entries WHERE user_id = ${DEV_USER_ID}::uuid`;
    } finally {
      await owner.end();
    }
  });

  beforeEach(async () => {
    a = await makeDevice(baseUrl as string);
    b = await makeDevice(baseUrl as string);
  });

  it('two stores converge through edit, push, pull, edit, push, pull', async () => {
    const t0 = Date.now();
    a.setClock(t0);
    const meal = await a.repo.addMeal(MEAL);
    await a.engine.dispatch();
    await b.engine.dispatch();
    expect((await b.meals()).find((row) => row.id === meal.id)?.name).toBe('Overnight oats');

    b.setClock(t0 + 1_000);
    await b.repo.editMeal(meal.id, { name: 'Overnight oats with berries', kcal: 360 });
    await b.engine.dispatch();
    await a.engine.dispatch();
    const aAfterFirstEdit = (await a.meals()).find((row) => row.id === meal.id);
    expect(aAfterFirstEdit?.name).toBe('Overnight oats with berries');
    expect(aAfterFirstEdit?.kcal).toBe(360);

    a.setClock(t0 + 2_000);
    await a.repo.editMeal(meal.id, { name: 'Overnight oats, second edit', kcal: 380 });
    await a.engine.dispatch();
    await b.engine.dispatch();
    await a.engine.dispatch();

    const bRow = (await b.meals()).find((row) => row.id === meal.id);
    expect(bRow?.name).toBe('Overnight oats, second edit');
    expect(bRow?.kcal).toBe(380);
    expect(shape(await a.meals())).toEqual(shape(await b.meals()));
    expect(await a.repo.hasPendingIntent(meal.id)).toBe(false);
    expect(await b.repo.hasPendingIntent(meal.id)).toBe(false);
  });

  it('a tombstone propagates to the other store', async () => {
    a.setClock(Date.now());
    const meal = await a.repo.addMeal(MEAL);
    await a.engine.dispatch();
    await b.engine.dispatch();
    expect((await b.meals()).find((row) => row.id === meal.id)?.deleted).toBe(false);

    b.setClock(Date.now() + 1_000);
    await b.repo.deleteMeal(meal.id);
    await b.engine.dispatch();
    await a.engine.dispatch();

    const aRow = (await a.meals()).find((row) => row.id === meal.id);
    expect(aRow === undefined || aRow.deleted).toBe(true);
    expect(await a.repo.hasPendingIntent(meal.id)).toBe(false);
    await b.engine.dispatch();
    expect(shape((await a.meals()).filter((row) => row.id === meal.id))).toEqual(
      shape((await b.meals()).filter((row) => row.id === meal.id)),
    );
  });

  it('in an offline conflict the loser store holds the server record after its acknowledgement', async () => {
    const t0 = Date.now();
    a.setClock(t0);
    const meal = await a.repo.addMeal(MEAL);
    await a.engine.dispatch();
    await b.engine.dispatch();

    // Both devices go offline and edit the same record: B's edit has the later client clock.
    a.setClock(t0 + 1_000);
    await a.repo.editMeal(meal.id, { name: 'edit from A (older clock)', kcal: 111 });
    b.setClock(t0 + 5_000);
    await b.repo.editMeal(meal.id, { name: 'edit from B (newer clock)', kcal: 555 });

    await b.engine.dispatch(); // B reaches the server first and wins
    // A's push loses. Its pull is switched off, so the acknowledgement alone must put the record in place.
    a.skipPull = true;
    const result = await a.engine.dispatch();
    a.skipPull = false;

    expect(result.acked).toBe(1);
    expect(await a.repo.hasPendingIntent(meal.id)).toBe(false);
    const loser = (await a.meals()).find((row) => row.id === meal.id);
    expect(loser?.name).toBe('edit from B (newer clock)');
    expect(loser?.kcal).toBe(555);
    expect(loser?.serverVersion).toBeGreaterThan(0);

    await a.engine.dispatch();
    await b.engine.dispatch();
    expect(shape(await a.meals())).toEqual(shape(await b.meals()));
  });
});
