/**
 * Route middleware for the scan-side routes: request parsing and `requireUser`.
 *
 * The fixed gate order is preflight -> JSON parse -> schema -> auth, so the body gates
 * run before `requireUser`: a malformed request answers 400 whether or not the caller is
 * signed in (the schema is the cheapest gate and leaks nothing).
 */
import type { MiddlewareHandler } from 'hono';
import type { z } from 'zod';

import { loadDevTokens, type TokenMap } from './auth/devTokens';
import { errorJson, zodIssues } from './http';

export type ScanAppEnv = { Variables: { userId: string; sessionId?: string; body: unknown } };

/** Parses the body as JSON, then validates it against `schema`; both failures are 400. */
export function validateJson(schema: z.ZodType): MiddlewareHandler<ScanAppEnv> {
  return async (c, next) => {
    const raw = await c.req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return errorJson(400, 'VALIDATION_ERROR', ['body must be valid JSON']);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', zodIssues(parsed.error));
    c.set('body', parsed.data);
    await next();
  };
}

export interface RequireUserOptions {
  /** Test seam: the dev-token map (default: apps/api/dev-tokens.json, loaded on first use). */
  tokens?: TokenMap;
  /** Verifies an API-signed access token and its live session (see auth/session.ts). */
  sessions?: SessionAuthenticator;
}

export interface SessionAuthenticator {
  authenticate(accessToken: string): Promise<{ userId: string; sessionId: string } | undefined>;
}

export function bearerToken(header: string | undefined): string {
  const value = header ?? '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : '';
}

/**
 * The one authentication point. A bearer token is accepted when it is
 *  - a checked-in dev token and AUTH_DEV_TOKENS=1 (read per request; off in production), or
 *  - an access token this API signed (HS256, sub + sid) whose session row is not revoked or expired.
 * Everything else answers 401 UNAUTHORIZED. Dev tokens carry no session (`sessionId` stays unset).
 */
export function requireUser(options: RequireUserOptions = {}): MiddlewareHandler<ScanAppEnv> {
  let tokens: TokenMap | undefined = options.tokens;
  return async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    if (token === '') return errorJson(401, 'UNAUTHORIZED');
    if (process.env.AUTH_DEV_TOKENS === '1') {
      tokens ??= loadDevTokens();
      const devUser = tokens[token];
      if (devUser !== undefined) {
        c.set('userId', devUser);
        return next();
      }
    }
    const claims = await options.sessions?.authenticate(token);
    if (!claims) return errorJson(401, 'UNAUTHORIZED');
    c.set('userId', claims.userId);
    c.set('sessionId', claims.sessionId);
    await next();
  };
}
