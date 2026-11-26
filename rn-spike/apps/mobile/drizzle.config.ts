import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config for the spike's local SQLite store (spec D4).
 * Run: `npx drizzle-kit@0.31.11 generate` from apps/mobile.
 * Migrations are consumed in bundled form by src/data/db/client.ts.
 */
export default {
  schema: './src/data/db/schema.ts',
  out: './src/data/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
