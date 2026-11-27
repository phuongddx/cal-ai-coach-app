/**
 * The Hono app, built without a listener so tests can drive it with
 * `app.request(...)` and `index.ts` can serve it.
 *
 * Deps are injected: the store (the `query(sql, params)` port) and the token
 * map, so tests run on PGlite with the checked-in dev tokens.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { bearerAuth, loadDevTokens, type TokenMap } from './auth';
import { registerSyncRoutes } from './sync';
import type { SyncStoreApi } from './store';

type AppEnv = { Variables: { userId: string } };

export type AppDeps = {
  store: SyncStoreApi;
  tokens?: TokenMap;
};

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.get('/health', (c) => c.json({ ok: true, service: 'coachcal-api' }));

  app.use('/v1/sync/*', bearerAuth(deps.tokens ?? loadDevTokens()));
  registerSyncRoutes(app, deps.store);

  app.notFound((c) => c.json({ error: { code: 'VALIDATION_ERROR', details: ['route'] } }, 404));

  // 500 INTERNAL is reserved for genuine bugs; the stack goes to the server
  // log, never into the body (spec D4 / AGENTS.md invariants). Hono's own
  // HTTPExceptions (e.g. malformed JSON body -> 400) keep their status and
  // get the uniform envelope.
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const code = err.status >= 400 && err.status < 500 ? 'VALIDATION_ERROR' : 'INTERNAL';
      return c.json({ error: { code, details: [err.message] } }, err.status);
    }
    console.error(`[api] 500 INTERNAL: ${err instanceof Error ? err.stack : String(err)}`);
    return c.json({ error: { code: 'INTERNAL' } }, 500);
  });

  return app;
}
