/**
 * The session store (`AuthSessionStore` of the Swift app) on expo-secure-store. The three Swift
 * AuthSessionTests need live credentials and are not ported:
 *   - liveSignInPersistsAndSecondClientRestoresSession  (covered here with the mocked keychain)
 *   - signOutClearsKeychainForSecondClient               (covered here with the mocked keychain)
 *   - liveSignInThenSyncEngineBindsAndDispatches         (needs a live API; not covered)
 */
import * as SecureStore from 'expo-secure-store';

import type { AuthError, Session } from './types';
import { createSessionStore, SESSION_STORAGE_KEY } from './sessionStore';

const NOW = Date.parse('2026-11-27T10:00:00.000Z');

const makeSession = (overrides: { accessToken?: string; refreshToken?: string; expiresAt?: string } = {}): Session => ({
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
  tokens: {
    accessToken: overrides.accessToken ?? 'access-1',
    refreshToken: overrides.refreshToken ?? 'refresh-1',
    expiresAt: overrides.expiresAt ?? '2026-11-27T10:15:00.000Z',
  },
});

const rejection = (status = 401): AuthError => ({ name: 'AuthError', kind: 'envelope', status, code: 'UNAUTHORIZED' });
const offline = (): AuthError => ({ name: 'AuthError', kind: 'network', message: 'offline' });

function makeStore(refreshSession: (token: string) => Promise<Session> = jest.fn(async (_token: string): Promise<Session> => makeSession({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: '2026-11-27T10:30:00.000Z' }))) {
  let now = NOW;
  const store = createSessionStore({ now: () => now, refreshSession });
  return { store, refreshSession, advance: (ms: number) => (now += ms) };
}

describe('session store', () => {
  it('starts without a session', async () => {
    const { store } = makeStore();
    expect(await store.load()).toBeNull();
    expect(store.getSession()).toBeNull();
    expect(await store.getAccessToken()).toBeNull();
  });

  it('sign in persists and a second store restores the session', async () => {
    const first = makeStore().store;
    await first.setSession(makeSession());
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY, expect.any(String));

    const second = makeStore().store;
    expect(second.getSession()).toBeNull(); // nothing until load() runs at start
    const restored = await second.load();
    expect(restored?.user.id).toBe('26277672-8328-4b1a-9b77-c2da2631f63c');
    expect(second.getSession()?.tokens.accessToken).toBe('access-1');
  });

  it('sign out clears the keychain for a second store', async () => {
    const first = makeStore().store;
    await first.setSession(makeSession());
    await first.clear();

    expect(first.getSession()).toBeNull();
    const second = makeStore().store;
    expect(await second.load()).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
  });

  it('a stored session that fails the contract is discarded', async () => {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify({ user: { id: 'nope' }, tokens: {} }));
    const { store } = makeStore();
    expect(await store.load()).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY);

    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, '{not json');
    expect(await makeStore().store.load()).toBeNull();
  });

  it('notifies listeners on sign in and sign out until they unsubscribe', async () => {
    const { store } = makeStore();
    const seen: Array<string | null> = [];
    const unsubscribe = store.onChange((session) => seen.push(session?.tokens.accessToken ?? null));

    await store.setSession(makeSession());
    await store.clear();
    unsubscribe();
    await store.setSession(makeSession());

    expect(seen).toEqual(['access-1', null]);
  });

  it('get access token returns the current token while it is fresh', async () => {
    const { store, refreshSession } = makeStore();
    await store.setSession(makeSession());
    expect(await store.getAccessToken()).toBe('access-1');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('get access token refreshes when the token is expired and keeps the rotated pair', async () => {
    const { store, refreshSession, advance } = makeStore();
    await store.setSession(makeSession());
    advance(16 * 60_000); // past expiresAt

    expect(await store.getAccessToken()).toBe('access-2');
    expect(refreshSession).toHaveBeenCalledWith('refresh-1');

    const second = makeStore().store;
    expect((await second.load())?.tokens.refreshToken).toBe('refresh-2');
  });

  it('refreshes slightly early so a token never expires in flight', async () => {
    const { store, refreshSession, advance } = makeStore();
    await store.setSession(makeSession());
    advance(14 * 60_000 + 40_000); // 20 s before expiry

    expect(await store.getAccessToken()).toBe('access-2');
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('concurrent refreshes share one request because the refresh token rotates', async () => {
    const { store, refreshSession } = makeStore();
    await store.setSession(makeSession());

    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('a failed refresh clears the session when the server rejects the refresh token', async () => {
    const refreshSession = jest.fn(async () => {
      throw rejection(401);
    });
    const { store } = makeStore(refreshSession);
    await store.setSession(makeSession());
    const seen: Array<Session | null> = [];
    store.onChange((session) => seen.push(session));

    expect(await store.refresh()).toBe(false);

    expect(store.getSession()).toBeNull();
    expect(seen).toEqual([null]);
    expect(await makeStore().store.load()).toBeNull();
    expect(await store.getAccessToken()).toBeNull();
  });

  it('a failed refresh keeps the session when the network or the server is down', async () => {
    for (const failure of [offline(), { name: 'AuthError', kind: 'envelope', status: 503, code: 'UPSTREAM_ERROR' } as AuthError]) {
      const { store, advance } = makeStore(jest.fn(async () => {
        throw failure;
      }));
      await store.setSession(makeSession());
      advance(16 * 60_000);

      expect(await store.refresh()).toBe(false);
      expect(store.getSession()?.tokens.refreshToken).toBe('refresh-1');
      // the stale token still goes out: offline it ends as a network failure, not a forced sign-out
      expect(await store.getAccessToken()).toBe('access-1');
    }
  });

  it('refresh without a session does nothing', async () => {
    const { store, refreshSession } = makeStore();
    expect(await store.refresh()).toBe(false);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('exposes a bearer for the api request seam', async () => {
    const { store } = makeStore();
    await store.setSession(makeSession());
    expect(await store.bearer.token()).toBe('access-1');
    expect(await store.bearer.refresh?.()).toBe(true);
    expect(await store.bearer.token()).toBe('access-2');
  });
});
