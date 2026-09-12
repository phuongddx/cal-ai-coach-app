import { defineConfig } from 'drizzle-kit';

/**
 * Migration generation: `npm run db:generate` (drizzle-kit@0.30.4 pinned with
 * drizzle-orm@0.45.2 — pairing smoke-proven in Plan 01-01). Generated SQL and
 * meta/_journal.json are COMMITTED artifacts bundled into the app binary by
 * src/db/migrations.ts.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
