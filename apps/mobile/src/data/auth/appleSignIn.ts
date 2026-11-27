/**
 * The Sign in with Apple call. `expo-apple-authentication` hands over the identity token, the
 * authorization code and, on the first sign-in only, the person's name. The request carries the
 * HASHED nonce (the package passes it through unhashed); the API gets the RAW nonce and hashes it
 * again to compare.
 */
import * as AppleAuthentication from 'expo-apple-authentication';

import { appleNonceAvailable, makeAppleNonce, type AppleNonceOptions } from './appleNonce';
import type { AuthApi } from './authApi';
import type { AuthError, Session } from './types';

export type AppleSignInOptions = { nonce?: AppleNonceOptions };

/** The Apple button shows only when the device can sign in AND the nonce can be hashed in this build. */
export async function appleSignInAvailable(options: AppleSignInOptions = {}): Promise<boolean> {
  try {
    return (await AppleAuthentication.isAvailableAsync()) && (await appleNonceAvailable(options.nonce));
  } catch {
    return false;
  }
}

export async function signInWithAppleCredential(api: AuthApi, options: AppleSignInOptions = {}): Promise<Session> {
  // Hash first: with no hash there is no sheet at all.
  const nonce = await makeAppleNonce(options.nonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });
  } catch (cause) {
    if ((cause as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED') {
      throw { name: 'AuthError', kind: 'cancelled' } satisfies AuthError;
    }
    throw {
      name: 'AuthError',
      kind: 'incompleteCredential',
      message: cause instanceof Error ? cause.message : 'Apple sign-in failed.',
    } satisfies AuthError;
  }

  if (!credential.identityToken) {
    throw {
      name: 'AuthError',
      kind: 'incompleteCredential',
      message: 'Apple sign-in did not return a usable credential.',
    } satisfies AuthError;
  }

  const { givenName, familyName } = credential.fullName ?? {};
  return api.signInWithApple({
    identityToken: credential.identityToken,
    nonce: nonce.raw,
    ...(credential.authorizationCode ? { authorizationCode: credential.authorizationCode } : {}),
    ...(givenName ? { givenName } : {}),
    ...(familyName ? { familyName } : {}),
  });
}
