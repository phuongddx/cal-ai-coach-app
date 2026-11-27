import type { SessionResponse, SessionUser } from '@coachcal/api-contract';

import type { Db } from '../db';
import { signAccessToken, verifyAccessToken, type AccessClaims } from './accessToken';
import { randomToken, sha256Hex } from './crypto';
import { callJson } from './sql';

/** Refresh tokens live 30 days from the last rotation; the access token lives 15 minutes. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export type RefreshOutcome =
  | { kind: 'ok'; session: SessionResponse }
  | { kind: 'invalid' }
  | { kind: 'reuse' };

export interface SessionServiceOptions {
  db: Db;
  jwtSecret: Uint8Array;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sessions: an API-signed access token (HS256, 15 minutes, sub + sid) backed by a row that can be
 * revoked, and an opaque rotating refresh token `<session id>.<random>` of which only the SHA-256 of the
 * random part is stored. Every database step is a narrow SECURITY DEFINER function.
 */
export class SessionService {
  private readonly db: Db;
  private readonly secret: Uint8Array;
  private readonly now: () => Date;

  constructor(options: SessionServiceOptions) {
    this.db = options.db;
    this.secret = options.jwtSecret;
    this.now = options.now ?? (() => new Date());
  }

  /** Creates a session for a verified user and returns the response body of every sign-in route. */
  async issue(user: SessionUser): Promise<SessionResponse> {
    const secretPart = randomToken(32);
    const sid = await this.db.withoutUser(async (query) => {
      const rows = await query<{ sid: string }>(
        `SELECT public.auth_session_create($1::uuid, $2, $3::int) AS sid`,
        [user.id, sha256Hex(secretPart), REFRESH_TTL_SECONDS],
      );
      const created = rows[0]?.sid;
      if (!created) throw new Error('auth_session_create returned no session id');
      return created;
    });
    return this.respond(user, sid, `${sid}.${secretPart}`);
  }

  /** Rotating refresh: a replaced token presented again revokes the whole session. */
  async refresh(refreshToken: string): Promise<RefreshOutcome> {
    const dot = refreshToken.indexOf('.');
    const sid = dot > 0 ? refreshToken.slice(0, dot) : '';
    const presented = dot > 0 ? refreshToken.slice(dot + 1) : '';
    if (!UUID.test(sid) || presented === '') return { kind: 'invalid' };
    const nextSecret = randomToken(32);
    const outcome = await this.db.withoutUser((query) =>
      callJson<{ result: 'ok' | 'invalid' | 'reuse'; user?: SessionUser }>(
        query,
        `public.auth_session_rotate($1::uuid, $2, $3, $4::int)`,
        [sid, sha256Hex(presented), sha256Hex(nextSecret), REFRESH_TTL_SECONDS],
      ),
    );
    if (!outcome || outcome.result === 'invalid') return { kind: 'invalid' };
    if (outcome.result === 'reuse') return { kind: 'reuse' };
    if (!outcome.user) throw new Error('auth_session_rotate returned ok without a user');
    return { kind: 'ok', session: await this.respond(outcome.user, sid, `${sid}.${nextSecret}`) };
  }

  /** The caller of a protected route: a valid unexpired access token whose session is still live. */
  async authenticate(accessToken: string): Promise<AccessClaims | undefined> {
    const claims = await verifyAccessToken(this.secret, accessToken);
    if (!claims) return undefined;
    const rows = await this.db.withoutUser((query) =>
      query<{ active: boolean }>(`SELECT public.auth_session_active($1::uuid, $2::uuid) AS active`, [
        claims.sessionId,
        claims.userId,
      ]),
    );
    return rows[0]?.active === true ? claims : undefined;
  }

  async signOut(userId: string, sessionId: string): Promise<void> {
    await this.db.withUser(userId, (query) =>
      query(`SELECT public.auth_session_revoke($1::uuid)`, [sessionId]),
    );
  }

  private async respond(user: SessionUser, sid: string, refreshToken: string): Promise<SessionResponse> {
    const { token, expiresAt } = await signAccessToken(this.secret, user.id, sid, this.now());
    return { user, tokens: { accessToken: token, refreshToken, expiresAt } };
  }
}
