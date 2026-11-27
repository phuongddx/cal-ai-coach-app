/**
 * Types of the sign-in boundary. The session is the contract's `SessionResponse` (user and tokens,
 * both opaque to the client). `AuthError` is a plain object: the failure kind plus what the screen
 * and the session store need to decide (a rejected refresh token clears the session, a dropped
 * connection does not).
 */
import type { ApiFailure } from '../api/http';
import type { SessionResponse } from '@coachcal/api-contract';

export type Session = SessionResponse;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type AuthError = { name: 'AuthError' } & (
  | DistributiveOmit<ApiFailure, 'name'>
  /** The person closed the Google browser sheet or the Apple sheet. */
  | { kind: 'cancelled' }
  /** The SHA-256 nonce could not be computed (expo-crypto missing in this build): no Apple sign-in. */
  | { kind: 'nonceUnavailable'; message: string }
  /** The provider answered without what the server needs (no identity token, no code in the redirect). */
  | { kind: 'incompleteCredential'; message: string }
  /** The input failed the contract before leaving the device (bad e-mail, code that is not six digits). */
  | { kind: 'invalidInput'; message: string; issues: unknown[] }
);

export function isAuthError(value: unknown): value is AuthError {
  return typeof value === 'object' && value !== null && (value as { name?: unknown }).name === 'AuthError';
}

/** True when the server definitively refused the credential (as opposed to being unreachable). */
export function isRejection(error: unknown): boolean {
  return isAuthError(error) && error.kind === 'envelope' && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

/** One calm line for the sign-in screen's error slot. */
export function authErrorMessage(error: AuthError): string {
  switch (error.kind) {
    case 'cancelled':
      return 'Sign-in was cancelled.';
    case 'network':
      return 'Could not reach CoachCal. Check your connection and try again.';
    case 'nonceUnavailable':
      return 'Sign in with Apple is not available in this build.';
    case 'incompleteCredential':
      return 'Sign-in did not return a usable credential. Please try again.';
    case 'invalidInput':
      return error.message;
    case 'envelope':
      if (error.code === 'UNAUTHORIZED') return 'That code or credential was not accepted. Please try again.';
      if (error.code === 'VALIDATION_ERROR') return 'Please check what you entered and try again.';
      if (error.code === 'UPSTREAM_ERROR') return 'That sign-in method is not available right now.';
      return 'Sign-in failed. Please try again.';
    case 'invalidResponse':
    case 'http':
      return 'Sign-in failed. Please try again.';
  }
}
