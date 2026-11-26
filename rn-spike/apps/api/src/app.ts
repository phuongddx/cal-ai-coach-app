import { Hono } from 'hono';

/**
 * The Hono app, built without a listener so tests can drive it with `app.request(...)`
 * and `index.ts` can serve it.
 */
export function createApp() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, service: 'coachcal-rn-spike-api' }));

  // TODO(spike item 4): POST /v1/sync/push, POST /v1/sync/pull

  return app;
}
