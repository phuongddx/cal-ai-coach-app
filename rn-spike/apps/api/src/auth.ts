/**
 * Dev-only bearer-token auth (spec D4: "Bearer token identifies the user …
 * This is not auth"). Tokens map 1:1 to fixed user ids from the checked-in
 * `apps/api/dev-tokens.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { MiddlewareHandler } from 'hono';

export type TokenMap = Record<string, string>;

export function loadDevTokens(filePath?: string): TokenMap {
  const resolved =
    filePath ??
    process.env.DEV_TOKENS_FILE ??
    // apps/api/src/auth.ts -> apps/api/dev-tokens.json
    path.resolve(__dirname, '../dev-tokens.json');
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as TokenMap;
}

/** 401 UNAUTHORIZED with the uniform envelope when the token is missing or unknown. */
export function bearerAuth(tokens: TokenMap): MiddlewareHandler<{ Variables: { userId: string } }> {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    const userId = token === '' ? undefined : tokens[token];
    if (userId === undefined) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', details: 'missing or unknown bearer token' } },
        401,
      );
    }
    c.set('userId', userId);
    await next();
  };
}
