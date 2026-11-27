/**
 * Twins of supabase/functions/tests/delete-account.test.ts, against DELETE /v1/account and the real
 * `account_delete` function. The caller is identified only by its session; nothing in the request can
 * name another account.
 */
import { describeSql, type Harness } from '../testing/sqlHarness';

const CASCADE_TABLES = ['diary_entries', 'sync_operations', 'scan_items', 'scans', 'scan_usage'] as const;

async function seedRows(h: Harness, userId: string): Promise<void> {
  const owner = h.owner;
  const scanId = crypto.randomUUID();
  const per100g = { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, fiberG: 1 };

  await owner`INSERT INTO public.diary_entries (id, user_id, display_text)
              VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, 'test entry')`;
  await owner`INSERT INTO public.sync_operations (user_id, op_id, table_name, record_id, kind, ack)
              VALUES (${userId}::uuid, ${crypto.randomUUID()}::uuid, 'diary_entries', ${crypto.randomUUID()}::uuid,
                      'upsert', ${owner.json({ serverVersion: 1, duplicate: false })})`;
  await owner`INSERT INTO public.scans (id, user_id, kind) VALUES (${scanId}::uuid, ${userId}::uuid, 'photo')`;
  await owner`INSERT INTO public.scan_usage (user_id, scan_id) VALUES (${userId}::uuid, ${crypto.randomUUID()}::uuid)`;
  await owner`INSERT INTO public.entitlements (app_user_id, entitlement_id, user_id, active)
              VALUES (${`app-${userId}`}, 'premium', ${userId}::uuid, true)`;
  // scan_items has an FK on (user_id, scan_id) referencing scans: insert after the parent row.
  await owner`INSERT INTO public.scan_items (id, user_id, scan_id, label, grams, per100g, kcal, macros)
              VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${scanId}::uuid, 'item', 100,
                      ${owner.json(per100g)}, 100, ${owner.json({})})`;
}

async function rowCounts(h: Harness, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of CASCADE_TABLES) {
    const [row] = await h.owner.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM public.${table} WHERE user_id = $1::uuid`,
      [userId],
    );
    counts[table] = row?.n ?? 0;
  }
  const [entitlements] = await h.owner<{ n: number }[]>`
    SELECT count(*)::int AS n FROM public.entitlements WHERE user_id = ${userId}::uuid`;
  counts.entitlements = entitlements?.n ?? 0;
  return counts;
}

async function accountExists(h: Harness, userId: string): Promise<boolean> {
  const [row] = await h.owner<{ n: number }[]>`SELECT count(*)::int AS n FROM public.users WHERE id = ${userId}::uuid`;
  return (row?.n ?? 0) > 0;
}

describeSql('DELETE /v1/account against the real account_delete function', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  it('handler: own-account deletion purges all six tables then deletes the auth user last', async () => {
    const h = harness();
    const user = await h.sessionUser();
    await seedRows(h, user.userId);

    const before = await rowCounts(h, user.userId);
    expect(Object.values(before).every((n) => n > 0)).toBe(true);

    const response = await h.call('DELETE', '/v1/account', user.accessToken);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const after = await rowCounts(h, user.userId);
    expect(Object.values(after).every((n) => n === 0)).toBe(true);
    expect(await accountExists(h, user.userId)).toBe(false);
  });

  it('handler: an unauthenticated request is rejected with zero writes', async () => {
    const h = harness();
    const user = await h.sessionUser();
    await seedRows(h, user.userId);

    const response = await h.call('DELETE', '/v1/account');
    expect(response.status).toBe(401);

    const after = await rowCounts(h, user.userId);
    expect(Object.values(after).every((n) => n > 0)).toBe(true);
    expect(await accountExists(h, user.userId)).toBe(true);
  });

  it('handler: a forged target uid in the body is ignored — only the caller is deleted', async () => {
    const h = harness();
    const caller = await h.sessionUser();
    const victim = await h.sessionUser();
    await seedRows(h, caller.userId);
    await seedRows(h, victim.userId);

    const response = await h.app.request('/v1/account?userId=' + victim.userId, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${caller.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: victim.userId }),
    });
    expect(response.status).toBe(200);

    const callerAfter = await rowCounts(h, caller.userId);
    expect(Object.values(callerAfter).every((n) => n === 0)).toBe(true);

    const victimAfter = await rowCounts(h, victim.userId);
    expect(Object.values(victimAfter).every((n) => n > 0)).toBe(true);
    expect(await accountExists(h, victim.userId)).toBe(true);
  });
});
