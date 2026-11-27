/**
 * One function per endpoint of `packages/api-contract/src/auth.ts`. Sign-in calls are
 * unauthenticated (no bearer, no refresh); `signOut` carries the access token. Input is checked
 * against the contract before it leaves the device; every failure is an `AuthError`.
 *
 * Google: open `GET /v1/auth/google/start` in the system auth session, catch the redirect to
 * `coachcal://auth/google?code=...`, then `POST /v1/auth/google/exchange` with the one-time code.
 * Tokens never travel in a URL.
 */
import * as WebBrowser from 'expo-web-browser';
import {
  AppleSignInRequestSchema,
  EmailSignInRequestSchema,
  GoogleExchangeRequestSchema,
  OkSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshRequestSchema,
  SessionResponseSchema,
  type AppleSignInRequest,
  type EmailSignInRequest,
} from '@coachcal/api-contract';
import type { ZodType } from 'zod';

import { apiRequest, isApiFailure, resolveBaseUrl, type BearerAuth } from '../api/http';
import type { AuthError, Session } from './types';

/** The redirect the API's Google callback sends the browser to. */
export const GOOGLE_REDIRECT_URL = 'coachcal://auth/google';

export type AuthSessionResult = { type: 'success'; url: string } | { type: 'cancel' | 'dismiss' | 'locked' | 'opened' };

export type AuthApiOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Test seam; defaults to `WebBrowser.openAuthSessionAsync`. */
  openAuthSession?: (url: string, redirectUrl: string) => Promise<AuthSessionResult>;
};

/** The `code` query parameter of a redirect URL, parsed by hand: React Native's URL has no reliable searchParams. */
export function codeFromRedirect(url: string): string | null {
  const query = url.split('#')[0]?.split('?')[1];
  if (!query) return null;
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === 'code') {
      const decoded = decodeURIComponent(value.replace(/\+/g, ' '));
      return decoded.length > 0 ? decoded : null;
    }
  }
  return null;
}

function invalidInput(message: string, issues: unknown[]): AuthError {
  return { name: 'AuthError', kind: 'invalidInput', message, issues };
}

export function createAuthApi(options: AuthApiOptions = {}) {
  const openAuthSession =
    options.openAuthSession ??
    ((url: string, redirectUrl: string) => WebBrowser.openAuthSessionAsync(url, redirectUrl) as Promise<AuthSessionResult>);

  async function call<T>(path: string, body: unknown, response: ZodType<T>, auth?: BearerAuth): Promise<T> {
    try {
      return await apiRequest({
        method: 'POST',
        path,
        body,
        response,
        auth,
        baseUrl: options.baseUrl,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      if (isApiFailure(error)) {
        const { name: _name, ...failure } = error;
        throw { ...failure, name: 'AuthError' } satisfies AuthError;
      }
      throw error;
    }
  }

  /** Validates the body against its contract schema, then posts it. */
  async function post<T>(path: string, schema: ZodType<unknown>, input: unknown, response: ZodType<T>, label: string): Promise<T> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw invalidInput(`${label} did not pass validation`, parsed.error.issues);
    return call(path, parsed.data, response);
  }

  const exchangeGoogleCode = (code: string) =>
    post('/v1/auth/google/exchange', GoogleExchangeRequestSchema, { code }, SessionResponseSchema, 'the Google code');

  return {
    signInWithApple: (request: AppleSignInRequest): Promise<Session> =>
      post('/v1/auth/apple', AppleSignInRequestSchema, request, SessionResponseSchema, 'the Apple credential'),

    async signInWithGoogle(): Promise<Session> {
      const base = (options.baseUrl ?? resolveBaseUrl()).replace(/\/+$/, '');
      const result = await openAuthSession(`${base}/v1/auth/google/start`, GOOGLE_REDIRECT_URL);
      if (result.type !== 'success') throw { name: 'AuthError', kind: 'cancelled' } satisfies AuthError;
      const code = codeFromRedirect(result.url);
      if (code === null) {
        throw { name: 'AuthError', kind: 'incompleteCredential', message: 'Google did not return a sign-in code.' } satisfies AuthError;
      }
      return exchangeGoogleCode(code);
    },

    signInWithEmail: (request: EmailSignInRequest): Promise<Session> =>
      post('/v1/auth/email', EmailSignInRequestSchema, request, SessionResponseSchema, 'the e-mail sign-in'),

    async requestOtp(email: string): Promise<void> {
      await post('/v1/auth/otp/request', OtpRequestSchema, { email }, OkSchema, 'the e-mail address');
    },

    verifyOtp: (email: string, code: string): Promise<Session> =>
      post('/v1/auth/otp/verify', OtpVerifySchema, { email, code }, SessionResponseSchema, 'the e-mail code'),

    refresh: (refreshToken: string): Promise<Session> =>
      post('/v1/auth/refresh', RefreshRequestSchema, { refreshToken }, SessionResponseSchema, 'the refresh token'),

    async signOut(auth: BearerAuth): Promise<void> {
      await call('/v1/auth/signout', undefined, OkSchema, auth);
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
