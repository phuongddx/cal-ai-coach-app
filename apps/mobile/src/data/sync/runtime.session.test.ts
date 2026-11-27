/**
 * The sync runtime on the signed-in user (unit U-23, section E): the transport's token comes from the
 * session store, mirror rows carry the session's user id, the engine is bound on sign-in and stopped on
 * sign-out, and without a session nothing leaves the device.
 */
import type { Session } from '../auth';
import { getSessionStore, resetAuthForTests } from '../auth';
import { createRepoFixture, type RepoFixture } from '../repos/testing/fixtures';
import { FakeServer } from './fakeServer';
import { getSyncRuntime, resetSyncRuntimeForTests } from './runtime';
import { LOCAL_OWNER_ID } from './store.sqlite';

const mockOpenLocalDb = jest.fn();
jest.mock('../db/client', () => ({ openLocalDb: (...args: unknown[]) => mockOpenLocalDb(...args) }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => undefined),
    fetch: jest.fn(async () => ({ isConnected: true })),
  },
}));

const USER_ID = '26277672-8328-4b1a-9b77-c2da2631f63c';
const OTHER_USER_ID = '3a6f1f0e-5c1e-4a52-9d6e-6a6c1d1b9a10';

const session = (userId: string, accessToken: string): Session => ({
  user: { id: userId, email: 'user@example.com', providers: ['email'] },
  tokens: { accessToken, refreshToken: 'refresh', expiresAt: '2099-01-01T00:00:00.000Z' },
});

const MEAL = {
  name: 'Overnight oats',
  kcal: 320,
  proteinG: 12,
  carbsG: 45,
  fatG: 9,
  fiberG: 6,
  eatenAt: '2026-11-27T01:00:00.000Z',
};

type RecordedCall = { path: string; authorization: string | undefined };

function installFetch(server: FakeServer): RecordedCall[] {
  const calls: RecordedCall[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({ path, authorization: (init?.headers as Record<string, string> | undefined)?.authorization });
    const body = JSON.parse(String(init?.body));
    const json =
      path === '/v1/sync/push' ? await server.push(body.operations) : await server.pull(body.cursor, body.limit);
    return { status: 200, text: async () => JSON.stringify(json) };
  }) as unknown as typeof fetch);
  return calls;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

let fixture: RepoFixture;

beforeEach(async () => {
  await getSessionStore().clear(); // the in-memory keychain outlives a test
  resetAuthForTests();
  resetSyncRuntimeForTests();
  fixture = await createRepoFixture();
  mockOpenLocalDb.mockResolvedValue({ db: fixture.db, sqlite: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetSyncRuntimeForTests();
});

function mirrorOwners(): string[] {
  const result = fixture.client.exec('SELECT user_id FROM diary_entries');
  return (result[0]?.values ?? []).map((row) => String(row[0]));
}

describe('sync runtime on the session user', () => {
  it('without a session the engine makes no request and reports unauthorized', async () => {
    const calls = installFetch(new FakeServer());
    const runtime = await getSyncRuntime();

    const result = await runtime.engine.sync();

    expect(result.status).toBe('unauthorized');
    expect(runtime.engine.currentOwner()).toBeNull();
    expect(calls).toEqual([]);
  });

  it('signing in binds the engine to the session user and the push carries its token', async () => {
    const calls = installFetch(new FakeServer());
    const runtime = await getSyncRuntime();

    await getSessionStore().setSession(session(USER_ID, 'access-user'));
    await settle();
    expect(runtime.engine.currentOwner()).toBe(USER_ID);

    await runtime.repository.addMeal(MEAL);
    const result = await runtime.engine.sync();

    expect(result.status).toBe('synced');
    expect(result.pushed).toBe(1);
    expect(mirrorOwners()).toEqual([USER_ID]);
    expect(calls.map((call) => call.path)).toContain('/v1/sync/push');
    expect(new Set(calls.map((call) => call.authorization))).toEqual(new Set(['Bearer access-user']));
  });

  it('a session restored from the keychain at launch binds the engine at once', async () => {
    installFetch(new FakeServer());
    await getSessionStore().setSession(session(USER_ID, 'access-user'));
    resetAuthForTests(); // a cold start: the memory is gone, the keychain stays
    resetSyncRuntimeForTests();

    const runtime = await getSyncRuntime();
    await settle();

    expect(runtime.engine.currentOwner()).toBe(USER_ID);
  });

  it('signing out stops the engine and later syncs make no request', async () => {
    const calls = installFetch(new FakeServer());
    const runtime = await getSyncRuntime();
    await getSessionStore().setSession(session(USER_ID, 'access-user'));
    await settle();
    await runtime.engine.sync();
    const before = calls.length;

    await getSessionStore().clear();
    await settle();
    const result = await runtime.engine.sync();

    expect(runtime.engine.currentOwner()).toBeNull();
    expect(result.status).toBe('unauthorized');
    expect(calls).toHaveLength(before);
  });

  it('a different user signing in rebinds the engine and new rows carry the new user id', async () => {
    installFetch(new FakeServer());
    const runtime = await getSyncRuntime();
    await getSessionStore().setSession(session(USER_ID, 'access-user'));
    await settle();

    await getSessionStore().setSession(session(OTHER_USER_ID, 'access-other'));
    await settle();
    expect(runtime.engine.currentOwner()).toBe(OTHER_USER_ID);

    await runtime.repository.addMeal(MEAL);
    expect(mirrorOwners()).toEqual([OTHER_USER_ID]);
  });

  it('the demo owner is used only when no session exists', async () => {
    installFetch(new FakeServer());
    const runtime = await getSyncRuntime();

    await runtime.repository.addMeal(MEAL);

    expect(mirrorOwners()).toEqual([LOCAL_OWNER_ID]);
    expect(runtime.engine.currentOwner()).toBeNull();
  });
});
