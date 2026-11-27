/**
 * The services the sign-in screen runs: each sign-in persists the session in the store (which is what
 * the rest of the app reads), sign-out is best effort on the server and certain on the device.
 */
import { createMockFetch, type MockFetch } from '../../testing/mockFetch';
import { createAuthApi, type AuthApiOptions } from './authApi';
import { createAuthServices } from './authServices';
import { createSessionStore } from './sessionStore';
import type { Session } from './types';

const baseUrl = 'http://api.test';
const sessionBody: Session = {
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: '2099-01-01T00:00:00.000Z' },
};

function setup(fetchImpl: MockFetch, extra: { openAuthSession?: AuthApiOptions['openAuthSession'] } = {}) {
  const api = createAuthApi({ baseUrl, fetchImpl, ...extra });
  const store = createSessionStore({ refreshSession: api.refresh });
  return { api, store, services: createAuthServices({ api, store }) };
}

describe('auth services', () => {
  it('verify code stores the session so the app is signed in', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const { store, services } = setup(fetchImpl);

    const session = await services.verifyCode('phuong@example.com', '123456');

    expect(session.user.email).toBe('phuong@example.com');
    expect(store.getSession()?.tokens.accessToken).toBe('access-1');
  });

  it('request code does not sign anyone in', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    const { store, services } = setup(fetchImpl);
    await services.requestCode('phuong@example.com');
    expect(store.getSession()).toBeNull();
  });

  it('google sign in stores the session', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const { store, services } = setup(fetchImpl, {
      openAuthSession: async () => ({ type: 'success', url: 'coachcal://auth/google?code=one-time' }),
    });
    await services.signInWithGoogle();
    expect(store.getSession()?.user.id).toBe(sessionBody.user.id);
  });

  it('apple sign in stores the session', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const { store, services } = setup(fetchImpl);
    await services.signInWithApple();
    expect(fetchImpl.calls[0]?.path).toBe('/v1/auth/apple');
    expect(store.getSession()?.tokens.refreshToken).toBe('refresh-1');
  });

  it('a failed sign in leaves no session behind', async () => {
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const { store, services } = setup(fetchImpl);
    await expect(services.verifyCode('phuong@example.com', '123456')).rejects.toMatchObject({ kind: 'envelope', status: 401 });
    expect(store.getSession()).toBeNull();
  });

  it('apple is offered only when the device and the build can do it', async () => {
    const { services } = setup(createMockFetch({ json: sessionBody }));
    expect(await services.appleAvailable()).toBe(true);
  });

  it('sign out tells the server and clears the device', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    const { store, services } = setup(fetchImpl);
    await store.setSession(sessionBody);

    await services.signOut();

    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/auth/signout' });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBe('Bearer access-1');
    expect(store.getSession()).toBeNull();
  });

  it('sign out clears the device even when the server cannot be reached', async () => {
    const fetchImpl = createMockFetch({ networkError: 'offline' });
    const { store, services } = setup(fetchImpl);
    await store.setSession(sessionBody);

    await expect(services.signOut()).resolves.toBeUndefined();

    expect(store.getSession()).toBeNull();
  });

  it('sign out without a session sends nothing', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    const { services } = setup(fetchImpl);
    await services.signOut();
    expect(fetchImpl.calls).toHaveLength(0);
  });
});
