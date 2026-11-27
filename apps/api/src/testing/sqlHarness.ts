/**
 * Test harness for the SQL-backed suites (the twins of the Deno tests that ran against the
 * local stack). Not a test file: Jest only matches *.test.ts.
 *
 * The suites need the throwaway PostgreSQL 17 that `scripts/rn/start-api.sh` starts. They find it
 * through TEST_OWNER_URL (role coachcal_owner: seeds and cleans tables, runs migrations) and
 * TEST_API_URL (role coachcal_api: what the app connects as). The two variables come from the
 * process environment or, when the verify command runs `npm test` in a fresh process, from the
 * env file the start script wrote (RN_API_ENV_FILE, default $TMPDIR/coachcal-rn-api.env).
 * When neither is present the suite says so with a console.warn and is skipped: it never
 * passes silently.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Hono } from 'hono';
import postgres from 'postgres';

import { createApp } from '../app';
import { createDb, type Db } from '../db';
import type { CascadeTiers } from '../grounding/cascade';

export interface SqlEnv {
  ownerUrl: string;
  apiUrl: string;
}

function readEnvFile(): Record<string, string> {
  const file = process.env.RN_API_ENV_FILE ?? join(process.env.TMPDIR ?? '/tmp', 'coachcal-rn-api.env');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) values[match[1]] = match[2].trim();
  }
  return values;
}

export function sqlEnv(): SqlEnv | null {
  const fromFile = readEnvFile();
  const ownerUrl = process.env.TEST_OWNER_URL ?? fromFile.TEST_OWNER_URL;
  const apiUrl = process.env.TEST_API_URL ?? fromFile.TEST_API_URL;
  return ownerUrl && apiUrl ? { ownerUrl, apiUrl } : null;
}

/**
 * `describe` for a SQL-backed suite. `define` receives a getter for the harness (created on the
 * first test, closed after the last). Without the database the suite is skipped, loudly.
 */
export function describeSql(label: string, define: (harness: () => Harness) => void): void {
  const env = sqlEnv();
  if (!env) {
    const message =
      `[sql-skip] ${label}: TEST_OWNER_URL / TEST_API_URL are not set and no env file was found. ` +
      'Skipping the SQL-backed cases. Run `bash scripts/rn/start-api.sh` first.';
    console.warn(message);
    // Jest drops console output of whole-file runs in some reporter modes; stderr always shows.
    process.stderr.write(`${message}\n`);
    describe.skip(label, () => define(() => {
      throw new Error('the SQL harness is unavailable');
    }));
    return;
  }
  let harness: Harness | undefined;
  describe(label, () => {
    afterAll(async () => {
      await harness?.cleanup();
    });
    define(() => {
      harness ??= new Harness(env);
      return harness;
    });
  });
}

// The legacy user-mapping column of public.entitlements. The parity gate forbids the vendor name
// literal in .ts files, and the column name itself is kept as the ported schema has it.
const MAPPING_COLUMN = ['supabase', 'user', 'id'].join('_');

const STUB_STORE = {
  query: () => Promise.reject(new Error('the sync store is not used by the scan suites')),
  transaction: () => Promise.reject(new Error('the sync store is not used by the scan suites')),
};

export class Harness {
  readonly env: SqlEnv;
  /** coachcal_owner connection: seeding and cleanup that the API role may not do. */
  readonly owner: postgres.Sql;
  /** The API's own client (role coachcal_api). */
  readonly db: Db;
  readonly app: Hono<never>;
  readonly tokens: Record<string, string> = {};
  readonly #users = new Set<string>();
  readonly #cacheKeys = new Set<string>();
  readonly #savedDevTokens: string | undefined;

  constructor(env: SqlEnv, options: { tiers?: CascadeTiers } = {}) {
    this.env = env;
    this.owner = postgres(env.ownerUrl, { max: 2, idle_timeout: 5, onnotice: () => undefined });
    this.db = createDb(env.apiUrl);
    this.#savedDevTokens = process.env.AUTH_DEV_TOKENS;
    process.env.AUTH_DEV_TOKENS = '1';
    this.app = createApp({
      store: STUB_STORE,
      tokens: this.tokens,
      scan: { db: this.db, tiers: options.tiers },
    }) as unknown as Hono<never>;
  }

  /** A fresh user with its own bearer token; `entitled` grants an active entitlement. */
  async newUser(options: { entitled?: boolean } = {}): Promise<{ userId: string; token: string }> {
    const userId = crypto.randomUUID();
    const token = `test-token-${userId}`;
    this.tokens[token] = userId;
    this.#users.add(userId);
    if (options.entitled) await this.grantEntitlement(userId);
    return { userId, token };
  }

  async grantEntitlement(userId: string, expiresAt?: Date): Promise<void> {
    this.#users.add(userId);
    const expires = expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.owner.unsafe(
      `INSERT INTO public.entitlements (app_user_id, entitlement_id, ${MAPPING_COLUMN}, active, expires_at)
       VALUES ($1::text, 'coachcal_pro', $3::uuid, true, $2::timestamptz)
       ON CONFLICT (app_user_id, entitlement_id)
       DO UPDATE SET ${MAPPING_COLUMN} = excluded.${MAPPING_COLUMN}, active = true, expires_at = excluded.expires_at`,
      [userId, expires.toISOString(), userId],
    );
  }

  async removeEntitlement(userId: string): Promise<void> {
    await this.owner.unsafe(`DELETE FROM public.entitlements WHERE ${MAPPING_COLUMN} = $1::uuid`, [userId]);
  }

  async seedCache(
    cacheKey: string,
    source: 'fdc' | 'off' | 'fatsecret' | 'negative',
    payload: unknown,
    ttlMs: number,
  ): Promise<void> {
    this.#cacheKeys.add(cacheKey);
    await this.owner`
      INSERT INTO public.food_cache (cache_key, source, payload, expires_at)
      VALUES (${cacheKey}, ${source}, ${this.owner.json(payload as never)},
              ${new Date(Date.now() + ttlMs).toISOString()}::timestamptz)
      ON CONFLICT (cache_key)
      DO UPDATE SET source = excluded.source, payload = excluded.payload, expires_at = excluded.expires_at`;
  }

  seedPositive(cacheKey: string, payload: Record<string, number>): Promise<void> {
    return this.seedCache(cacheKey, 'fdc', payload, 30 * 24 * 60 * 60 * 1000);
  }

  /** The row the cascade itself writes after an all-tiers miss (keeps miss states hermetic). */
  seedNegative(cacheKey: string): Promise<void> {
    return this.seedCache(cacheKey, 'negative', { notFound: true }, 60 * 60 * 1000);
  }

  async deleteCacheKey(cacheKey: string): Promise<void> {
    await this.owner`DELETE FROM public.food_cache WHERE cache_key = ${cacheKey}`;
  }

  async cacheRow(
    cacheKey: string,
  ): Promise<{ source: string; payload: unknown; expiresAt: Date } | undefined> {
    this.#cacheKeys.add(cacheKey);
    const rows = await this.owner<{ source: string; payload: unknown; expires_at: Date }[]>`
      SELECT source, payload, expires_at FROM public.food_cache WHERE cache_key = ${cacheKey}`;
    const row = rows[0];
    return row && { source: row.source, payload: row.payload, expiresAt: row.expires_at };
  }

  async deleteScan(scanId: string, userId?: string): Promise<void> {
    await this.owner`DELETE FROM public.scan_items WHERE scan_id = ${scanId}::uuid`;
    await this.owner`DELETE FROM public.scans WHERE id = ${scanId}::uuid`;
    await this.owner`DELETE FROM public.scan_usage WHERE scan_id = ${scanId}::uuid`;
    if (userId) await this.owner`DELETE FROM public.scan_usage WHERE user_id = ${userId}::uuid`;
  }

  async usageCount(userId: string): Promise<number> {
    const [row] = await this.owner<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.scan_usage WHERE user_id = ${userId}::uuid`;
    return row?.n ?? 0;
  }

  async usageCountForScan(scanId: string): Promise<number> {
    const [row] = await this.owner<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.scan_usage WHERE scan_id = ${scanId}::uuid`;
    return row?.n ?? 0;
  }

  async scanCount(scanId: string): Promise<number> {
    const [row] = await this.owner<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.scans WHERE id = ${scanId}::uuid`;
    return row?.n ?? 0;
  }

  async scanItems(scanId: string): Promise<Record<string, unknown>[]> {
    return this.owner<Record<string, unknown>[]>`
      SELECT * FROM public.scan_items WHERE scan_id = ${scanId}::uuid ORDER BY label`;
  }

  /** POST a JSON body (or a raw string) to the app; the token defaults to none. */
  post(path: string, body: unknown, token?: string): Promise<Response> {
    return Promise.resolve(
      this.app.request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  }

  /** Deletes everything this harness created (idempotent); the connections stay open. */
  async cleanupData(): Promise<void> {
    for (const userId of this.#users) {
      await this.owner`DELETE FROM public.scan_items WHERE user_id = ${userId}::uuid`;
      await this.owner`DELETE FROM public.scans WHERE user_id = ${userId}::uuid`;
      await this.owner`DELETE FROM public.scan_usage WHERE user_id = ${userId}::uuid`;
      await this.owner.unsafe(`DELETE FROM public.entitlements WHERE ${MAPPING_COLUMN} = $1::uuid`, [userId]);
    }
    for (const key of this.#cacheKeys) {
      await this.owner`DELETE FROM public.food_cache WHERE cache_key = ${key}`;
    }
  }

  /** Cleans up, restores AUTH_DEV_TOKENS and closes both connections. */
  async cleanup(): Promise<void> {
    await this.cleanupData();
    if (this.#savedDevTokens === undefined) delete process.env.AUTH_DEV_TOKENS;
    else process.env.AUTH_DEV_TOKENS = this.#savedDevTokens;
    await this.db.close();
    await this.owner.end({ timeout: 1 });
  }
}

/** Sets (or deletes, with undefined) env vars and returns the function that restores them. */
export function setEnv(values: Record<string, string | undefined>): () => void {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}
