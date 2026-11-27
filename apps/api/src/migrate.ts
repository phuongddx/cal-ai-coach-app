/**
 * Applies `apps/api/migrations/*.sql` in file-name order, each file inside one
 * transaction, skipping the ones recorded in `schema_migrations`. Run it as role
 * coachcal_owner: `DATABASE_URL=postgres://coachcal_owner@... npx tsx src/migrate.ts`
 * from `apps/api`. `migrate(sql)` is also callable from a test against a fresh database.
 */
import fs from 'node:fs';
import path from 'node:path';

import postgres from 'postgres';

export function defaultMigrationsDir(): string {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve('migrations'),
    path.resolve('apps/api/migrations'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`migrations directory not found (tried ${candidates.join(', ')})`);
  return found;
}

/** Returns the names of the migrations applied by this call, in order. */
export async function migrate(
  sql: postgres.Sql,
  dir: string = defaultMigrationsDir(),
): Promise<string[]> {
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS public.schema_migrations (
       name       text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const done = new Set(
    (await sql.unsafe('SELECT name FROM public.schema_migrations')).map((row) => String(row.name)),
  );
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx.unsafe('INSERT INTO public.schema_migrations (name) VALUES ($1)', [file]);
    });
    applied.push(file);
  }
  return applied;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be configured (role coachcal_owner)');
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    const applied = await migrate(sql);
    console.log(
      applied.length > 0
        ? `[migrate] applied ${applied.join(', ')}`
        : '[migrate] nothing to apply, database is up to date',
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}

// Run when executed directly (`tsx src/migrate.ts`), not when imported by a test.
if (/(^|[\\/])migrate\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) {
  main().catch((error: unknown) => {
    console.error(`[migrate] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
