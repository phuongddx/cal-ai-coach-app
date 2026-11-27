/**
 * Route middleware for the scan-side routes: request parsing and `requireUser`.
 *
 * The fixed gate order is preflight -> JSON parse -> schema -> auth, so the body gates
 * run before `requireUser`: a malformed request answers 400 whether or not the caller is
 * signed in (the schema is the cheapest gate and leaks nothing).
 */
import type { MiddlewareHandler } from 'hono';
import type { z } from 'zod';

import { loadDevTokens, type TokenMap } from './auth';
import { errorJson, zodIssues } from './http';

export type ScanAppEnv = { Variables: { userId: string; body: unknown } };

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
}

/**
 * The one authentication point. In this unit it accepts the checked-in dev tokens only
 * when AUTH_DEV_TOKENS=1 (read per request); otherwise every protected route answers 401.
 * A later unit replaces the inside of this function with real session verification.
 */
export function requireUser(options: RequireUserOptions = {}): MiddlewareHandler<ScanAppEnv> {
  let tokens: TokenMap | undefined = options.tokens;
  return async (c, next) => {
    if (process.env.AUTH_DEV_TOKENS !== '1') return errorJson(401, 'UNAUTHORIZED');
    tokens ??= loadDevTokens();
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    const userId = token === '' ? undefined : tokens[token];
    if (userId === undefined) return errorJson(401, 'UNAUTHORIZED');
    c.set('userId', userId);
    await next();
  };
}
