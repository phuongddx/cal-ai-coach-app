import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { GoogleConfig } from '../../config';
import { hmacHex, randomToken, safeEqual, sha256Hex } from '../crypto';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
/** Google signs with either form of the issuer. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const STATE_TTL_SECONDS = 10 * 60;

export interface GoogleIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export class GoogleUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleUpstreamError';
  }
}

export interface GoogleProviderOptions {
  config: GoogleConfig;
  /** Server secret that signs the OAuth state. */
  stateSecret: Buffer;
  fetch?: typeof fetch;
  getKey?: JWTVerifyGetKey;
  now?: () => Date;
}

/**
 * Google sign-in through the system browser: the app opens /v1/auth/google/start, Google redirects
 * to /v1/auth/google/callback, which redirects the browser to coachcal://auth/google?code=<one-time
 * code>. Tokens never travel in a URL.
 *
 * CSRF protection: `start` mints a random value `n`, sets it as an HttpOnly cookie and puts a signed
 * state (expiry + HMAC over `n`) and nonce = SHA-256(n) in the authorization request. `callback`
 * accepts only when the cookie, the state signature, the expiry and the ID token nonce all agree.
 */
export class GoogleProvider {
  private readonly config: GoogleConfig;
  private readonly stateSecret: Buffer;
  private readonly fetchImpl: typeof fetch;
  private readonly getKey: JWTVerifyGetKey;
  private readonly now: () => Date;

  constructor(options: GoogleProviderOptions) {
    this.config = options.config;
    this.stateSecret = options.stateSecret;
    this.fetchImpl = options.fetch ?? fetch;
    this.getKey = options.getKey ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    this.now = options.now ?? (() => new Date());
  }

  private sign(n: string, expiresAt: number): string {
    return hmacHex(this.stateSecret, `google-state.${n}.${expiresAt}`);
  }

  /** The browser redirect target and the cookie value that binds it to this browser. */
  start(): { location: string; cookie: string } {
    const n = randomToken(16);
    const expiresAt = Math.floor(this.now().getTime() / 1000) + STATE_TTL_SECONDS;
    const state = `${expiresAt}.${this.sign(n, expiresAt)}`;
    const query = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce: sha256Hex(n),
      prompt: 'select_account',
    });
    return { location: `${GOOGLE_AUTH_URL}?${query.toString()}`, cookie: n };
  }

  /** True when `state` is ours, unexpired and bound to the cookie value `n`. */
  checkState(state: string, n: string): boolean {
    const [expiresRaw, signature] = state.split('.');
    const expiresAt = Number(expiresRaw);
    if (!signature || !Number.isInteger(expiresAt) || n === '') return false;
    if (expiresAt < Math.floor(this.now().getTime() / 1000)) return false;
    return safeEqual(signature, this.sign(n, expiresAt));
  }

  /** Exchanges the authorization code and verifies the returned ID token. */
  async identityFromCode(code: string, n: string): Promise<GoogleIdentity> {
    let response: Response;
    try {
      response = await this.fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
    } catch {
      throw new GoogleUpstreamError('Google could not be reached');
    }
    const body = (await response.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
    if (!response.ok || typeof body.id_token !== 'string') {
      if (body.error === 'invalid_grant') throw new GoogleAuthError('authorization code was rejected');
      throw new GoogleUpstreamError(`Google token endpoint answered ${response.status}`);
    }
    return this.verifyIdToken(body.id_token, n);
  }

  async verifyIdToken(idToken: string, n: string): Promise<GoogleIdentity> {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(idToken, this.getKey, {
        issuer: GOOGLE_ISSUERS,
        audience: this.config.clientId,
        algorithms: ['RS256'],
        currentDate: this.now(),
      }));
    } catch {
      throw new GoogleAuthError('ID token verification failed');
    }
    const nonce = payload['nonce'];
    if (typeof nonce !== 'string' || !safeEqual(nonce, sha256Hex(n))) {
      throw new GoogleAuthError('ID token nonce does not match');
    }
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new GoogleAuthError('ID token has no subject');
    const email = typeof payload['email'] === 'string' && payload['email'] !== '' ? payload['email'] : null;
    const verified = payload['email_verified'];
    return { subject: payload.sub, email, emailVerified: verified === true || verified === 'true' };
  }
}
