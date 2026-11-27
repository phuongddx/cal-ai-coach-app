/**
 * Real entrypoint: postgres.js store from DATABASE_URL + the checked-in dev
 * tokens, served on 127.0.0.1. `scripts/start-api.sh` sets DATABASE_URL.
 */
import { serve } from '@hono/node-server';

import { createApp } from './app';
import { loadDevTokens } from './auth';
import { createPostgresStore } from './store.postgres';

const port = Number(process.env.PORT ?? 8787);
const connectionString = process.env.DATABASE_URL ?? 'postgres://127.0.0.1:5433/coachcal_spike';

const { store, close } = createPostgresStore(connectionString);
const server = serve(
  { fetch: createApp({ store, tokens: loadDevTokens() }).fetch, port, hostname: '127.0.0.1' },
  (info) => {
    console.log(`[api] coachcal spike sync API listening on http://127.0.0.1:${info.port}`);
  },
);

const shutdown = (signal: string) => {
  console.log(`[api] ${signal} received, closing`);
  server.close((error) => {
    void close().finally(() => process.exit(error ? 1 : 0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
