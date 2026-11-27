/**
 * Entrypoint: validates the environment (a missing server secret stops the process here, not at the
 * first request), optionally runs the migrations, then serves the API.
 */
import { serve } from '@hono/node-server';

import { buildRunning, runStartupMigrations } from './bootstrap';
import { ConfigError, loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.runMigrationsOnStart) {
    const applied = await runStartupMigrations(config);
    console.log(applied.length > 0 ? `[api] migrations applied: ${applied.join(', ')}` : '[api] migrations up to date');
  }
  if (config.devTokens) console.warn('[api] AUTH_DEV_TOKENS=1: checked-in dev tokens are accepted. Never set this in production.');
  for (const [name, provider] of [['Apple', config.apple], ['Google', config.google]] as const) {
    if (!provider.configured) console.warn(`[api] ${name} sign-in disabled: ${provider.missing.join(', ')} not set`);
  }

  const { app, db, stopTimers } = buildRunning(config);
  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`[api] coachcal API listening on http://${config.host}:${info.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, closing`);
    stopTimers();
    server.close((error) => {
      void db.close().finally(() => process.exit(error ? 1 : 0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(`[api] cannot start: ${error instanceof ConfigError ? error.message : error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
