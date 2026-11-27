/**
 * The Hono app, built without a listener so tests can drive it with `app.request(...)` and
 * `index.ts` can serve it.
 *
 * Deps are injected (database, session service, providers, mail sender, webhook secret) so tests run
 * against the real SQL functions with stub providers. Every route except /health, /v1/auth/* sign-in
 * routes and /webhooks/revenuecat sits behind `requireUser`.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { registerAuthRoutes, type AuthDeps } from './auth/routes';
import type { TokenMap } from './auth/devTokens';
import type { CascadeTiers } from './grounding/cascade';
import { preflight } from './http';
import type { ScanAppEnv } from './middleware';
import { registerScanRoutes } from './scan/route';
import { registerSyncRoutes } from './sync';
import { registerWebhookRoute } from './webhook/route';

export type AppDeps = {
  auth: AuthDeps;
  /** HMAC secret of the purchase-provider webhook (RC_WEBHOOK_SIGNING_SECRET). */
  webhookSecret: Buffer | string;
  /** Test seam: the dev-token map (honoured only while AUTH_DEV_TOKENS=1). */
  tokens?: TokenMap;
  /** Test seam: substitutes the grounding tiers of the scan routes. */
  tiers?: CascadeTiers;
};

export function createApp(deps: AppDeps) {
  const app = new Hono<ScanAppEnv>();
  const { db, sessions } = deps.auth;
  const guard = { tokens: deps.tokens, sessions };

  app.get('/health', (c) => c.json({ ok: true, service: 'coachcal-api' }));

  app.options('/v1/*', (c) => preflight(c.req.raw) ?? c.body(null, 204));
  registerAuthRoutes(app, deps.auth, guard);
  registerSyncRoutes(app, { db }, guard);
  registerScanRoutes(app, { db, tiers: deps.tiers }, guard);
  registerWebhookRoute(app, { db, secret: deps.webhookSecret });

  app.notFound((c) => c.json({ error: { code: 'VALIDATION_ERROR', details: ['route'] } }, 404));

  // 500 INTERNAL is reserved for genuine bugs; the stack goes to the server log, never into the
  // body (AGENTS.md invariants). Hono's own HTTPExceptions keep their status with the uniform envelope.
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
