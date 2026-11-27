/**
 * One function per endpoint of packages/api-contract/src/auth.ts, over the mocked fetch and the
 * mocked expo-web-browser. Sign-in endpoints are unauthenticated: no bearer, no refresh.
 */
import * as WebBrowser from 'expo-web-browser';

import { createMockFetch } from '../../testing/mockFetch';
import { createAuthApi, type AuthApiOptions } from './authApi';
import { isAuthError, type AuthError, type Session } from './types';

const baseUrl = 'http://api.test';

const sessionBody = {
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['apple', 'email'] },
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: '2026-11-27T10:15:00.000Z' },
};

async function errorOf(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (error) {
    expect(isAuthError(error)).toBe(true);
    return error as AuthError;
  }
  throw new Error('expected an AuthError');
}

const apiWith = (fetchImpl: typeof fetch, openAuthSession?: AuthApiOptions['openAuthSession']) =>
  createAuthApi({ baseUrl, fetchImpl, openAuthSession });

describe('auth api', () => {
  it('apple sign in posts the identity token, the raw nonce and the first sign in name', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const session: Session = await apiWith(fetchImpl).signInWithApple({
      identityToken: 'apple.identity.token',
      nonce: 'raw-nonce',
      authorizationCode: 'auth-code',
      givenName: 'Phuong',
      familyName: 'Doan',
    });

    expect(session.user.providers).toEqual(['apple', 'email']);
    expect(fetchImpl.calls[0]).toMatchObject({
      path: '/v1/auth/apple',
      method: 'POST',
      body: {
        identityToken: 'apple.identity.token',
        nonce: 'raw-nonce',
        authorizationCode: 'auth-code',
        givenName: 'Phuong',
        familyName: 'Doan',
      },
    });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBeUndefined();
  });

  it('apple sign in omits the optional fields it was not given', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    await apiWith(fetchImpl).signInWithApple({ identityToken: 't', nonce: 'n' });
    expect(fetchImpl.calls[0]?.body).toEqual({ identityToken: 't', nonce: 'n' });
  });

  it('google sign in opens the start endpoint, reads the one time code from the redirect and exchanges it', async () => {
    const openAuthSession = jest.fn(async (_url: string, _redirect: string) => ({
      type: 'success' as const,
      url: 'coachcal://auth/google?code=one-time-code',
    }));
    const fetchImpl = createMockFetch({ json: sessionBody });

    const session = await apiWith(fetchImpl, openAuthSession).signInWithGoogle();

    expect(openAuthSession).toHaveBeenCalledWith('http://api.test/v1/auth/google/start', 'coachcal://auth/google');
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/auth/google/exchange', body: { code: 'one-time-code' } });
    expect(session.tokens.accessToken).toBe('access-1');
  });

  it('google sign in uses the shared auth session of expo web browser by default', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      url: 'coachcal://auth/google?code=abc%2B123',
    });
    const fetchImpl = createMockFetch({ json: sessionBody });

    await apiWith(fetchImpl).signInWithGoogle();

    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('http://api.test/v1/auth/google/start', 'coachcal://auth/google');
    expect(fetchImpl.calls[0]?.body).toEqual({ code: 'abc+123' });
  });

  it('google sign in that the person closes is cancelled and exchanges nothing', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    for (const type of ['cancel', 'dismiss'] as const) {
      const error = await errorOf(apiWith(fetchImpl, async () => ({ type })).signInWithGoogle());
      expect(error.kind).toBe('cancelled');
    }
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('google redirect without a code is an incomplete credential', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    for (const url of ['coachcal://auth/google', 'coachcal://auth/google?error=access_denied', 'coachcal://auth/google?code=']) {
      const error = await errorOf(apiWith(fetchImpl, async () => ({ type: 'success' as const, url })).signInWithGoogle());
      expect(error.kind).toBe('incompleteCredential');
    }
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('e-mail sign in posts the credentials of an existing user', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    await apiWith(fetchImpl).signInWithEmail({ email: 'phuong@example.com', password: 'correct horse' });
    expect(fetchImpl.calls[0]).toMatchObject({
      path: '/v1/auth/email',
      body: { email: 'phuong@example.com', password: 'correct horse' },
    });
  });

  it('request code posts the e-mail and resolves without a session', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    await expect(apiWith(fetchImpl).requestOtp('phuong@example.com')).resolves.toBeUndefined();
    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/auth/otp/request', body: { email: 'phuong@example.com' } });
  });

  it('verify code posts the six digits and returns the session', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const session = await apiWith(fetchImpl).verifyOtp('phuong@example.com', '123456');
    expect(fetchImpl.calls[0]).toMatchObject({
      path: '/v1/auth/otp/verify',
      body: { email: 'phuong@example.com', code: '123456' },
    });
    expect(session.user.email).toBe('phuong@example.com');
  });

  it('input that fails the contract never reaches the network', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    const api = apiWith(fetchImpl);

    expect((await errorOf(api.requestOtp('not-an-email'))).kind).toBe('invalidInput');
    expect((await errorOf(api.verifyOtp('phuong@example.com', '12345'))).kind).toBe('invalidInput');
    expect((await errorOf(api.verifyOtp('phuong@example.com', 'abcdef'))).kind).toBe('invalidInput');
    expect((await errorOf(api.signInWithEmail({ email: 'phuong@example.com', password: 'short' }))).kind).toBe('invalidInput');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('refresh posts the refresh token and returns the rotated session', async () => {
    const fetchImpl = createMockFetch({ json: sessionBody });
    await apiWith(fetchImpl).refresh('refresh-0');
    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/auth/refresh', body: { refreshToken: 'refresh-0' } });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBeUndefined();
  });

  it('sign out posts to the sign out endpoint with the access token', async () => {
    const fetchImpl = createMockFetch({ json: { ok: true } });
    await apiWith(fetchImpl).signOut({ token: async () => 'access-1' });
    expect(fetchImpl.calls[0]).toMatchObject({ path: '/v1/auth/signout', method: 'POST' });
    expect(fetchImpl.calls[0]?.headers['authorization']).toBe('Bearer access-1');
  });

  it('a wrong credential is an envelope error with its status and code', async () => {
    const fetchImpl = createMockFetch({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    const error = await errorOf(apiWith(fetchImpl).verifyOtp('phuong@example.com', '123456'));
    expect(error).toMatchObject({ kind: 'envelope', status: 401, code: 'UNAUTHORIZED' });
  });

  it('a provider the server is not configured for is an upstream error', async () => {
    const fetchImpl = createMockFetch({ status: 503, json: { error: { code: 'UPSTREAM_ERROR' } } });
    const error = await errorOf(apiWith(fetchImpl).signInWithApple({ identityToken: 't', nonce: 'n' }));
    expect(error).toMatchObject({ kind: 'envelope', status: 503, code: 'UPSTREAM_ERROR' });
  });

  it('a session body with an unknown key is an invalid response (invariant I10)', async () => {
    const fetchImpl = createMockFetch({ json: { ...sessionBody, extra: true } });
    const error = await errorOf(apiWith(fetchImpl).refresh('refresh-0'));
    expect(error.kind).toBe('invalidResponse');
  });

  it('a dropped connection is a network error', async () => {
    const fetchImpl = createMockFetch({ networkError: 'offline' });
    expect((await errorOf(apiWith(fetchImpl).requestOtp('phuong@example.com'))).kind).toBe('network');
  });
});
