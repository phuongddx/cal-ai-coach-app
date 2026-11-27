/**
 * /v1/auth/* and DELETE /v1/account, exactly the endpoints of packages/api-contract/src/auth.ts.
 *
 * Every database step is a SECURITY DEFINER function (`auth_*`, `account_delete`); the API role holds
 * no table privileges. Wrong credentials of every kind answer 401 UNAUTHORIZED with no detail, so a
 * response never tells which part was wrong. A provider whose variables are missing answers
 * 503 UPSTREAM_ERROR naming the variables (never their values).
 */
import {
  AppleSignInRequestSchema,
  EmailSignInRequestSchema,
  GoogleExchangeRequestSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshRequestSchema,
  type SessionUser,
} from '@coachcal/api-contract';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomInt } from 'node:crypto';

import type { Config } from '../config';
import type { Db } from '../db';
import { errorJson, json, preflight } from '../http';
import { requireUser, validateJson, type RequireUserOptions, type ScanAppEnv } from '../middleware';
import { decryptSecret, deriveKey, encryptSecret, hashPassword, hmacHex, randomToken, sha256Hex, verifyPassword } from './crypto';
import type { OtpSender } from './otpSender';
import { AppleAuthError, AppleUpstreamError, type AppleProvider } from './providers/apple';
import { GoogleAuthError, GoogleUpstreamError, type GoogleProvider } from './providers/google';
import { RateLimiter } from './rateLimit';
import type { SessionService } from './session';
import { callJson } from './sql';

/** How long the code mailed to the user stays valid. */
export const OTP_TTL_SECONDS = 10 * 60;
/** How long the one-time code handed to the app after Google's redirect stays valid. */
export const ONE_TIME_TTL_SECONDS = 2 * 60;
export const GOOGLE_COOKIE = 'cc_google_state';
export const APP_REDIRECT = 'coachcal://auth/google';

const MINUTE = 60_000;

/** In-memory limits; see RateLimiter for the single-instance caveat. */
export interface AuthLimits {
  otpRequestEmail: RateLimiter;
  otpRequestIp: RateLimiter;
  otpVerifyEmail: RateLimiter;
  otpVerifyIp: RateLimiter;
  emailSignInEmail: RateLimiter;
  emailSignInIp: RateLimiter;
}

export function createAuthLimits(now?: () => number): AuthLimits {
  const make = (limit: number, windowMs: number) => new RateLimiter({ limit, windowMs, now });
  return {
    otpRequestEmail: make(5, 60 * MINUTE),
    otpRequestIp: make(20, 60 * MINUTE),
    otpVerifyEmail: make(10, 15 * MINUTE),
    otpVerifyIp: make(30, 15 * MINUTE),
    emailSignInEmail: make(10, 15 * MINUTE),
    emailSignInIp: make(30, 15 * MINUTE),
  };
}

export interface AuthDeps {
  db: Db;
  sessions: SessionService;
  config: Pick<Config, 'apple' | 'google' | 'encryptionSecret' | 'publicBaseUrl'>;
  otpSender: OtpSender;
  apple?: AppleProvider;
  google?: GoogleProvider;
  limits?: AuthLimits;
  /** Test seam: a fixed six-digit code. */
  generateCode?: () => string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * The caller's address behind the reverse proxy: the LAST X-Forwarded-For entry (the one the proxy
 * appended; earlier entries are client-supplied), else the socket address.
 */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last;
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}

function tooMany(): Response {
  const response = errorJson(429, 'VALIDATION_ERROR', ['too many attempts, try again later']);
  response.headers.set('Retry-After', '900');
  return response;
}

function notConfigured(provider: string, missing: string[]): Response {
  return errorJson(503, 'UPSTREAM_ERROR', [`${provider} sign-in is not configured: set ${missing.join(', ')}`]);
}

export function registerAuthRoutes(app: Hono<ScanAppEnv>, deps: AuthDeps, auth: RequireUserOptions): void {
  const limits = deps.limits ?? createAuthLimits();
  const otpKey = deriveKey(deps.config.encryptionSecret, 'otp');
  const appleKey = deriveKey(deps.config.encryptionSecret, 'apple-refresh-token');
  const generateCode = deps.generateCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, '0'));
  const otpHash = (email: string, code: string) => hmacHex(otpKey, `${email}.${code}`);
  const secureCookie = deps.config.publicBaseUrl.startsWith('https://');
  let dummyHash: Promise<string> | undefined;

  const requireSession = requireUser(auth);

  app.options('/v1/account', (c) => preflight(c.req.raw) ?? c.body(null, 204));

  // ---- Apple --------------------------------------------------------------------------------
  app.post('/v1/auth/apple', validateJson(AppleSignInRequestSchema), async (c) => {
    if (!deps.apple) return notConfigured('Apple', deps.config.apple.missing);
    const body = c.get('body') as ReturnType<typeof AppleSignInRequestSchema.parse>;
    try {
      const identity = await deps.apple.verifyIdentityToken(body.identityToken, body.nonce);
      // The code exchange runs before the user exists so a rejected code creates nothing.
      const refreshToken = body.authorizationCode
        ? await deps.apple.exchangeAuthorizationCode(body.authorizationCode)
        : undefined;
      const user = await deps.db.withoutUser((query) =>
        callJson<SessionUser>(query, `public.auth_sign_in_identity('apple', $1, $2, $3)`, [
          identity.subject,
          identity.email,
          identity.emailVerified,
        ]),
      );
      if (!user) throw new Error('auth_sign_in_identity returned no user');
      if (refreshToken) {
        const sealed = encryptSecret(refreshToken, appleKey);
        await deps.db.withUser(user.id, (query) => query(`SELECT public.auth_apple_token_store($1)`, [sealed]));
      }
      return json(200, await deps.sessions.issue(user));
    } catch (error) {
      if (error instanceof AppleAuthError) return errorJson(401, 'UNAUTHORIZED');
      if (error instanceof AppleUpstreamError) return errorJson(503, 'UPSTREAM_ERROR', ['Apple sign-in is unavailable']);
      throw error;
    }
  });

  // ---- Google -------------------------------------------------------------------------------
  app.get('/v1/auth/google/start', (c) => {
    if (!deps.google) return notConfigured('Google', deps.config.google.missing);
    const { location, cookie } = deps.google.start();
    setCookie(c, GOOGLE_COOKIE, cookie, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'Lax',
      path: '/v1/auth/google',
      maxAge: 600,
    });
    return c.redirect(location, 302);
  });

  app.get('/v1/auth/google/callback', async (c) => {
    if (!deps.google) return notConfigured('Google', deps.config.google.missing);
    const fail = (reason: string) => {
      deleteCookie(c, GOOGLE_COOKIE, { path: '/v1/auth/google' });
      return c.redirect(`${APP_REDIRECT}?error=${reason}`, 302);
    };
    const n = getCookie(c, GOOGLE_COOKIE) ?? '';
    const state = c.req.query('state') ?? '';
    const code = c.req.query('code') ?? '';
    if (c.req.query('error')) return fail('denied');
    if (code === '' || !deps.google.checkState(state, n)) return fail('invalid_state');
    try {
      const identity = await deps.google.identityFromCode(code, n);
      const user = await deps.db.withoutUser((query) =>
        callJson<SessionUser>(query, `public.auth_sign_in_identity('google', $1, $2, $3)`, [
          identity.subject,
          identity.email,
          identity.emailVerified,
        ]),
      );
      if (!user) throw new Error('auth_sign_in_identity returned no user');
      const oneTime = randomToken(32);
      await deps.db.withoutUser((query) =>
        query(`SELECT public.auth_one_time_issue($1, $2::uuid, $3::int)`, [
          sha256Hex(oneTime),
          user.id,
          ONE_TIME_TTL_SECONDS,
        ]),
      );
      deleteCookie(c, GOOGLE_COOKIE, { path: '/v1/auth/google' });
      return c.redirect(`${APP_REDIRECT}?code=${oneTime}`, 302);
    } catch (error) {
      if (error instanceof GoogleAuthError) return fail('rejected');
      if (error instanceof GoogleUpstreamError) return fail('unavailable');
      throw error;
    }
  });

  app.post('/v1/auth/google/exchange', validateJson(GoogleExchangeRequestSchema), async (c) => {
    const body = c.get('body') as ReturnType<typeof GoogleExchangeRequestSchema.parse>;
    const user = await deps.db.withoutUser((query) =>
      callJson<SessionUser>(query, `public.auth_one_time_consume($1)`, [sha256Hex(body.code)]),
    );
    if (!user) return errorJson(401, 'UNAUTHORIZED');
    return json(200, await deps.sessions.issue(user));
  });

  // ---- E-mail + password (existing users only) ----------------------------------------------
  app.post('/v1/auth/email', validateJson(EmailSignInRequestSchema), async (c) => {
    const body = c.get('body') as ReturnType<typeof EmailSignInRequestSchema.parse>;
    const email = normalizeEmail(body.email);
    if (!limits.emailSignInEmail.hit(email) || !limits.emailSignInIp.hit(clientIp(c))) return tooMany();
    const found = await deps.db.withoutUser((query) =>
      callJson<{ userId: string; passwordHash: string | null }>(query, `public.auth_password_lookup($1)`, [email]),
    );
    // Unknown user, user without a password and wrong password all cost one scrypt run and answer alike.
    dummyHash ??= hashPassword(randomToken(16));
    const stored = found?.passwordHash ?? (await dummyHash);
    const matches = await verifyPassword(body.password, stored);
    if (!found || !found.passwordHash || !matches) return errorJson(401, 'UNAUTHORIZED');
    const user = await deps.db.withoutUser((query) =>
      callJson<SessionUser>(query, `public.auth_user_get($1::uuid)`, [found.userId]),
    );
    if (!user) return errorJson(401, 'UNAUTHORIZED');
    return json(200, await deps.sessions.issue(user));
  });

  // ---- E-mail code --------------------------------------------------------------------------
  app.post('/v1/auth/otp/request', validateJson(OtpRequestSchema), async (c) => {
    const body = c.get('body') as ReturnType<typeof OtpRequestSchema.parse>;
    const email = normalizeEmail(body.email);
    if (!limits.otpRequestEmail.hit(email) || !limits.otpRequestIp.hit(clientIp(c))) return tooMany();
    const code = generateCode();
    await deps.db.withoutUser((query) =>
      query(`SELECT public.auth_otp_issue($1, $2, $3::int)`, [email, otpHash(email, code), OTP_TTL_SECONDS]),
    );
    try {
      await deps.otpSender.send(email, code);
    } catch {
      return errorJson(503, 'UPSTREAM_ERROR', ['the sign-in code could not be delivered']);
    }
    return json(200, { ok: true });
  });

  app.post('/v1/auth/otp/verify', validateJson(OtpVerifySchema), async (c) => {
    const body = c.get('body') as ReturnType<typeof OtpVerifySchema.parse>;
    const email = normalizeEmail(body.email);
    if (!limits.otpVerifyEmail.hit(email) || !limits.otpVerifyIp.hit(clientIp(c))) return tooMany();
    const outcome = await deps.db.withoutUser((query) =>
      callJson<{ result: 'ok' | 'invalid' | 'expired' | 'locked'; user?: SessionUser }>(
        query,
        `public.auth_otp_verify($1, $2)`,
        [email, otpHash(email, body.code)],
      ),
    );
    if (!outcome || outcome.result !== 'ok' || !outcome.user) return errorJson(401, 'UNAUTHORIZED');
    return json(200, await deps.sessions.issue(outcome.user));
  });

  // ---- Session ------------------------------------------------------------------------------
  app.post('/v1/auth/refresh', validateJson(RefreshRequestSchema), async (c) => {
    const body = c.get('body') as ReturnType<typeof RefreshRequestSchema.parse>;
    const outcome = await deps.sessions.refresh(body.refreshToken);
    if (outcome.kind !== 'ok') return errorJson(401, 'UNAUTHORIZED');
    return json(200, outcome.session);
  });

  app.post('/v1/auth/signout', requireSession, async (c) => {
    const sessionId = c.get('sessionId');
    if (sessionId) await deps.sessions.signOut(c.get('userId'), sessionId);
    return json(200, { ok: true });
  });

  // ---- Account deletion ---------------------------------------------------------------------
  app.delete('/v1/account', requireSession, async (c) => {
    const result = await deps.db.withUser(c.get('userId'), (query) =>
      callJson<{ deleted: boolean; appleRefreshTokenEnc: string | null }>(query, `public.account_delete()`, []),
    );
    // The Apple token is revoked after the data is gone and the transaction committed. A failure
    // here cannot undo the deletion, so it is logged (without the token) and the request still succeeds.
    if (result?.appleRefreshTokenEnc && deps.apple) {
      try {
        await deps.apple.revokeRefreshToken(decryptSecret(result.appleRefreshTokenEnc, appleKey));
      } catch (error) {
        console.error(`[api] apple revoke failed after account deletion: ${error instanceof Error ? error.name : 'error'}`);
      }
    }
    return json(200, { ok: true });
  });
}
