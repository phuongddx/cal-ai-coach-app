/**
 * Sync over the real session store: a 401 refreshes the session once and retries once, and a refresh
 * the server rejects clears the session (acceptance criteria of U-20).
 */
import { createFetchSyncTransport } from '../api/syncClient';
import { createMockFetch } from '../../testing/mockFetch';
import { syncGolden } from '../../testing/syncGolden';
import { SyncError } from '../sync/types';
import { createAuthApi } from './authApi';
import { createSessionStore } from './sessionStore';
import type { Session } from './types';

const baseUrl = 'http://api.test';
const session = (accessToken: string, refreshToken: string): Session => ({
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: null, providers: ['apple'] },
  tokens: { accessToken, refreshToken, expiresAt: '2099-01-01T00:00:00.000Z' },
});

function setup(replies: Parameters<typeof createMockFetch>[0]) {
  const fetchImpl = createMockFetch(replies);
  const api = createAuthApi({ baseUrl, fetchImpl });
  const store = createSessionStore({ refreshSession: api.refresh });
  const transport = createFetchSyncTransport({
    baseUrl,
    fetchImpl,
    tokenProvider: store.getAccessToken,
    refreshSession: store.refresh,
  });
  return { fetchImpl, store, transport };
}

describe('sync over the session store', () => {
  it('a 401 on sync triggers one refresh and one retry', async () => {
    const { fetchImpl, store, transport } = setup((request) => {
      if (request.path === '/v1/auth/refresh') return { json: session('access-2', 'refresh-2') };
      return request.headers['authorization'] === 'Bearer access-2'
        ? { json: syncGolden('sync_pull_response') }
        : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } };
    });
    await store.setSession(session('access-1', 'refresh-1'));

    const response = await transport.pull(0, 200);

    expect(response.cursor).toBe(13);
    expect(fetchImpl.calls.map((call) => `${call.path} ${call.headers['authorization'] ?? '-'}`)).toEqual([
      '/v1/sync/pull Bearer access-1',
      '/v1/auth/refresh -',
      '/v1/sync/pull Bearer access-2',
    ]);
    expect(fetchImpl.calls[1]?.body).toEqual({ refreshToken: 'refresh-1' });
    expect(store.getSession()?.tokens.refreshToken).toBe('refresh-2');
  });

  it('a failed refresh clears the session and the sync call ends unauthorized', async () => {
    const { fetchImpl, store, transport } = setup((request) =>
      request.path === '/v1/auth/refresh'
        ? { status: 401, json: { error: { code: 'UNAUTHORIZED' } } }
        : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } },
    );
    await store.setSession(session('access-1', 'refresh-1'));

    const error = await transport.pull(0, 200).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SyncError);
    expect((error as SyncError).kind).toBe('unauthorized');
    expect(store.getSession()).toBeNull();
    expect(fetchImpl.calls.map((call) => call.path)).toEqual(['/v1/sync/pull', '/v1/auth/refresh']);

    // signed out now: the next call sends nothing at all
    const again = await transport.pull(0, 200).catch((caught: unknown) => caught);
    expect((again as SyncError).kind).toBe('unauthorized');
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('a refresh that cannot reach the server keeps the session for the next attempt', async () => {
    const { store, transport } = setup((request) =>
      request.path === '/v1/auth/refresh' ? { networkError: 'offline' } : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } },
    );
    await store.setSession(session('access-1', 'refresh-1'));

    await transport.pull(0, 200).catch(() => undefined);

    expect(store.getSession()?.tokens.refreshToken).toBe('refresh-1');
  });
});
