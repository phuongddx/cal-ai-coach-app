import { ErrorEnvelopeSchema } from '@coachcal/api-contract';
import postgres from 'postgres';

import { migrate } from './migrate';
import { describeSql } from './testing/sqlHarness';

// Invariant I2 as the API role (coachcal_api) sees it: no table privileges, EXECUTE on the
// SECURITY DEFINER functions, and every function bound to the caller's own user.
const SCAN_TABLES = ['scans', 'scan_items', 'scan_usage', 'food_cache'] as const;

async function sqlState(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}

function scanPayload(scanId: string, userId: string) {
  return {
    scan: { id: scanId, user_id: userId, kind: 'photo', meal_type: 'lunch' },
    items: [
      {
        id: crypto.randomUUID(),
        label: 'rice',
        grams: 100,
        per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 },
        kcal: 130,
        macros: { proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 },
        confidence: 0.9,
        hidden_fat_likely: false,
        source: 'fdc',
      },
    ],
  };
}

describeSql('privileges and migrations (SQL-backed)', (harness) => {
  it.each(SCAN_TABLES)('coachcal_api cannot SELECT directly from %s', async (table) => {
    const h = harness();
    const { userId } = await h.newUser();
    const state = await sqlState(
      h.db.withUser(userId, (query) => query(`SELECT * FROM public.${table} LIMIT 1`)),
    );
    expect(state).toBe('42501'); // insufficient_privilege
  });

  it('coachcal_api cannot write the scan tables directly either', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const state = await sqlState(
      h.db.withUser(userId, (query) =>
        query(`INSERT INTO public.scan_usage (user_id, scan_id) VALUES ($1::uuid, $2::uuid)`, [
          userId,
          crypto.randomUUID(),
        ]),
      ),
    );
    expect(state).toBe('42501');
  });

  it('persist_scan succeeds for the caller\'s own user', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const scanId = crypto.randomUUID();
    const { scan, items } = scanPayload(scanId, userId);
    try {
      await h.db.withUser(userId, (query) =>
        query('SELECT public.persist_scan($1::jsonb, $2::jsonb)', [scan, items]),
      );
      expect(await h.scanCount(scanId)).toBe(1);
      expect((await h.scanItems(scanId)).length).toBe(1);
    } finally {
      await h.deleteScan(scanId, userId);
    }
  });

  it('persist_scan rejects another user\'s rows before any write', async () => {
    const h = harness();
    const caller = await h.newUser();
    const victim = await h.newUser();
    const scanId = crypto.randomUUID();
    const { scan, items } = scanPayload(scanId, victim.userId);
    try {
      const state = await sqlState(
        h.db.withUser(caller.userId, (query) =>
          query('SELECT public.persist_scan($1::jsonb, $2::jsonb)', [scan, items]),
        ),
      );
      expect(state).toBe('42501');
      expect(await h.scanCount(scanId)).toBe(0);
    } finally {
      await h.deleteScan(scanId);
    }
  });

  it('claim_scan_credit succeeds for the caller\'s own user and needs an authenticated user', async () => {
    const h = harness();
    const { userId } = await h.newUser();
    const scanId = crypto.randomUUID();
    try {
      const [row] = await h.db.withUser(userId, (query) =>
        query<{ verdict: { claimed: boolean; used: number; limit: number } }>(
          'SELECT public.claim_scan_credit($1::uuid) AS verdict',
          [scanId],
        ),
      );
      expect(row?.verdict.claimed).toBe(true);
      expect(row?.verdict.limit).toBe(3);
      expect(await h.usageCount(userId)).toBe(1); // the usage row belongs to the caller

      // With no app.user_id the function has no owner to claim for.
      const state = await sqlState(
        h.db.withUser('', (query) =>
          query('SELECT public.claim_scan_credit($1::uuid)', [crypto.randomUUID()]),
        ),
      );
      expect(state).toBe('42501');
    } finally {
      await h.deleteScan(scanId, userId);
    }
  });

  it('claim_scan_credit counts per caller: another user\'s claim never uses this user\'s quota', async () => {
    const h = harness();
    const a = await h.newUser();
    const b = await h.newUser();
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    try {
      for (const scanId of ids.slice(0, 3)) {
        await h.db.withUser(a.userId, (query) =>
          query('SELECT public.claim_scan_credit($1::uuid)', [scanId]),
        );
      }
      const [row] = await h.db.withUser(b.userId, (query) =>
        query<{ verdict: { claimed: boolean; used: number } }>(
          'SELECT public.claim_scan_credit($1::uuid) AS verdict',
          [ids[3]],
        ),
      );
      expect(row?.verdict.claimed).toBe(true);
      expect(row?.verdict.used).toBe(1);
      expect(await h.usageCount(a.userId)).toBe(3);
    } finally {
      for (const scanId of ids) await h.deleteScan(scanId);
      await h.deleteScan(ids[0]!, a.userId);
      await h.deleteScan(ids[3]!, b.userId);
    }
  });

  it('migrate(sql) applies every migration to a fresh database and is idempotent', async () => {
    const h = harness();
    const name = `coachcal_migrate_${Date.now()}`;
    await h.owner.unsafe(`CREATE DATABASE ${name}`);
    const url = new URL(h.env.ownerUrl);
    url.pathname = `/${name}`;
    const fresh = postgres(url.toString(), { max: 1, onnotice: () => undefined });
    try {
      const first = await migrate(fresh);
      expect(first.length).toBeGreaterThanOrEqual(4);
      expect(first).toEqual([...first].sort());
      expect(await migrate(fresh)).toEqual([]); // a second run has nothing to apply
      const [fn] = await fresh<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
         WHERE s.nspname = 'public' AND p.proname IN ('persist_scan', 'claim_scan_credit', 'sync_push', 'sync_pull')`;
      expect(fn?.n).toBe(4);
    } finally {
      await fresh.end({ timeout: 1 });
      await h.owner.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    }
  }, 30_000);

  it('every error body of the scan routes parses with ErrorEnvelopeSchema', async () => {
    const h = harness();
    const { token } = await h.newUser();
    const cases: Array<[string, unknown, string | undefined, number]> = [
      ['/v1/scan', 'not json', undefined, 400],
      ['/v1/scan', { scanId: 'nope' }, undefined, 400],
      ['/v1/scan', { scanId: crypto.randomUUID(), kind: 'photo', imageBase64: 'fixture-photo' }, undefined, 401],
      ['/v1/barcode/resolve', { barcode: 'abc' }, token, 400],
      ['/v1/barcode/resolve', { barcode: '12345670' }, undefined, 401],
      ['/v1/foods/search', { query: '' }, token, 400],
      ['/v1/foods/search', { query: 'cheddar' }, undefined, 401],
    ];
    for (const [path, body, bearer, status] of cases) {
      const res = await h.post(path, body, bearer);
      expect(res.status).toBe(status);
      expect(ErrorEnvelopeSchema.safeParse(await res.json()).success).toBe(true);
    }
  });

  it('GET /health answers ok', async () => {
    const h = harness();
    const res = await h.app.request('/health');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });
});
