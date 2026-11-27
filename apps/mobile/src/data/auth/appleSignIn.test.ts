/**
 * Sign in with Apple through expo-apple-authentication: the identity token, the authorization code
 * and (first sign-in only) the name go to the API; the request carries the HASHED nonce and the
 * server receives the RAW one.
 */
import { createHash } from 'crypto';
import * as AppleAuthentication from 'expo-apple-authentication';

import { appleSignInAvailable, signInWithAppleCredential } from './appleSignIn';
import type { AuthApi } from './authApi';
import { isAuthError, type AuthError, type Session } from './types';

const session: Session = {
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: null, providers: ['apple'] },
  tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-11-27T10:15:00.000Z' },
};

const makeApi = () => {
  const signInWithApple = jest.fn(async (_request: unknown) => session);
  return { api: { signInWithApple } as unknown as AuthApi, signInWithApple };
};

const signInAsync = AppleAuthentication.signInAsync as jest.Mock;

async function errorOf(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (error) {
    expect(isAuthError(error)).toBe(true);
    return error as AuthError;
  }
  throw new Error('expected an AuthError');
}

// jest.setup.ts resets these mocks through `jest.requireMock`, which is a different instance than the
// one `import` resolves here (finding in docs/rn-migration/findings/U-20.md), so clear them locally.
beforeEach(() => {
  signInAsync.mockClear();
  (AppleAuthentication.isAvailableAsync as jest.Mock).mockClear();
});

describe('apple sign in', () => {
  it('sends the hashed nonce to apple and the raw nonce to the server', async () => {
    const { api, signInWithApple } = makeApi();

    const result = await signInWithAppleCredential(api);

    expect(result).toBe(session);
    const appleRequest = signInAsync.mock.calls[0]![0] as { nonce: string; requestedScopes: unknown[] };
    const serverRequest = signInWithApple.mock.calls[0]![0] as { nonce: string };
    expect(appleRequest.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(serverRequest.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(appleRequest.nonce).not.toBe(serverRequest.nonce);
    expect(createHash('sha256').update(serverRequest.nonce).digest('hex')).toBe(appleRequest.nonce);
    expect(appleRequest.requestedScopes).toEqual([
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ]);
  });

  it('forwards the identity token, the authorization code and the first sign in name', async () => {
    const { api, signInWithApple } = makeApi();
    await signInWithAppleCredential(api);
    expect(signInWithApple).toHaveBeenCalledWith(
      expect.objectContaining({
        identityToken: 'mock.identity.token',
        authorizationCode: 'mock-authorization-code',
        givenName: 'Mock',
        familyName: 'User',
      }),
    );
  });

  it('leaves the name out on a later sign in when apple does not send it', async () => {
    signInAsync.mockResolvedValueOnce({
      ...(await AppleAuthentication.signInAsync({ requestedScopes: [] })),
      fullName: null,
      authorizationCode: null,
    });
    const { api, signInWithApple } = makeApi();

    await signInWithAppleCredential(api);

    const request = signInWithApple.mock.calls[0]![0] as Record<string, unknown>;
    expect(request).not.toHaveProperty('givenName');
    expect(request).not.toHaveProperty('familyName');
    expect(request).not.toHaveProperty('authorizationCode');
  });

  it('closing the apple sheet is a cancellation, not a failure', async () => {
    signInAsync.mockRejectedValueOnce(Object.assign(new Error('The user canceled'), { code: 'ERR_REQUEST_CANCELED' }));
    const { api, signInWithApple } = makeApi();

    expect((await errorOf(signInWithAppleCredential(api))).kind).toBe('cancelled');
    expect(signInWithApple).not.toHaveBeenCalled();
  });

  it('apple answering without an identity token is an incomplete credential', async () => {
    signInAsync.mockResolvedValueOnce({ ...(await AppleAuthentication.signInAsync({ requestedScopes: [] })), identityToken: null });
    const { api, signInWithApple } = makeApi();

    expect((await errorOf(signInWithAppleCredential(api))).kind).toBe('incompleteCredential');
    expect(signInWithApple).not.toHaveBeenCalled();
  });

  it('without a nonce hash the sheet is never presented', async () => {
    const { api } = makeApi();
    const error = await errorOf(
      signInWithAppleCredential(api, {
        nonce: { loadCrypto: async () => { throw new Error('no ExpoCrypto'); } },
      }),
    );
    expect(error.kind).toBe('nonceUnavailable');
    expect(signInAsync).not.toHaveBeenCalled();
  });

  it('is available only when apple sign in works on the device and the nonce can be hashed', async () => {
    expect(await appleSignInAvailable()).toBe(true);

    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await appleSignInAvailable()).toBe(false);

    expect(await appleSignInAvailable({ nonce: { loadCrypto: async () => { throw new Error('no ExpoCrypto'); } } })).toBe(false);
  });
});
