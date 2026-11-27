import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { AppleConfig } from '../../config';
import { safeEqual, sha256Hex } from '../crypto';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** Apple rejects a client secret that lives longer than six months; this one lives five minutes. */
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

export interface AppleIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

/** The identity token or the nonce is wrong: the caller is not who they claim (401). */
export class AppleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleAuthError';
  }
}

/** Apple could not be reached or answered something unexpected (503). */
export class AppleUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleUpstreamError';
  }
}

export interface AppleProviderOptions {
  config: AppleConfig;
  /** PEM text of the .p8 key (read once at startup by the caller). */
  privateKeyPem: string;
  fetch?: typeof fetch;
  /** Test seam: a local JWKS instead of Apple's. */
  getKey?: JWTVerifyGetKey;
  now?: () => Date;
}

/**
 * Sign in with Apple, server side. client_id is the App ID (the bundle id): the iOS app starts the
 * authorization with its App ID, the identity token's `aud` is that App ID, and Apple's docs say the
 * identifier sent to /auth/token and /auth/revoke "must match the value provided during the
 * authorization request". A Services ID would be needed only for a web flow, which this app has not.
 */
export class AppleProvider {
  private readonly config: AppleConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly getKey: JWTVerifyGetKey;
  private readonly now: () => Date;
  private readonly pem: string;
  private signingKey: Awaited<ReturnType<typeof importPKCS8>> | undefined;

  constructor(options: AppleProviderOptions) {
    this.config = options.config;
    this.pem = options.privateKeyPem;
    this.fetchImpl = options.fetch ?? fetch;
    this.getKey = options.getKey ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    this.now = options.now ?? (() => new Date());
  }

  /** Verifies signature, issuer, audience, expiry and the nonce; returns the account identity. */
  async verifyIdentityToken(identityToken: string, rawNonce: string): Promise<AppleIdentity> {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(identityToken, this.getKey, {
        issuer: APPLE_ISSUER,
        audience: this.config.bundleId,
        algorithms: ['RS256'],
        currentDate: this.now(),
      }));
    } catch {
      throw new AppleAuthError('identity token verification failed');
    }
    // Apple puts the nonce it was given in the claim; the app hashed the raw nonce with SHA-256.
    const claim = payload['nonce'];
    if (typeof claim !== 'string' || !safeEqual(claim, sha256Hex(rawNonce))) {
      throw new AppleAuthError('identity token nonce does not match');
    }
    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new AppleAuthError('identity token has no subject');
    }
    const email = typeof payload['email'] === 'string' && payload['email'] !== '' ? payload['email'] : null;
    const verified = payload['email_verified'];
    return {
      subject: payload.sub,
      email,
      emailVerified: verified === true || verified === 'true',
    };
  }

  private async clientSecret(): Promise<string> {
    this.signingKey ??= await importPKCS8(this.pem, 'ES256');
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.config.keyId })
      .setIssuer(this.config.teamId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + CLIENT_SECRET_TTL_SECONDS)
      .setAudience(APPLE_ISSUER)
      .setSubject(this.config.bundleId)
      .sign(this.signingKey);
  }

  private async post(url: string, form: Record<string, string>): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
      });
    } catch {
      throw new AppleUpstreamError('Apple could not be reached');
    }
  }

  /**
   * Exchanges the authorization code for the refresh token that account deletion revokes.
   * An `invalid_grant` answer means the code itself is bad (the caller's fault); anything else
   * (bad client secret, Apple down) is ours.
   */
  async exchangeAuthorizationCode(code: string): Promise<string> {
    const response = await this.post(APPLE_TOKEN_URL, {
      client_id: this.config.bundleId,
      client_secret: await this.clientSecret(),
      code,
      grant_type: 'authorization_code',
    });
    const body = (await response.json().catch(() => ({}))) as { refresh_token?: unknown; error?: unknown };
    if (response.ok && typeof body.refresh_token === 'string' && body.refresh_token !== '') {
      return body.refresh_token;
    }
    if (body.error === 'invalid_grant') throw new AppleAuthError('authorization code was rejected');
    throw new AppleUpstreamError(`Apple token endpoint answered ${response.status}`);
  }

  /** Revokes the user's Apple refresh token (App Store rule for account deletion). */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const response = await this.post(APPLE_REVOKE_URL, {
      client_id: this.config.bundleId,
      client_secret: await this.clientSecret(),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });
    if (!response.ok) throw new AppleUpstreamError(`Apple revoke endpoint answered ${response.status}`);
  }
}
