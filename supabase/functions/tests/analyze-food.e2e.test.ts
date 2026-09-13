import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../analyze-food/index.ts';
import { stackEnv } from './_env.ts';
import { ScanResponseSchema } from '../_shared/contracts/scan.ts';
import { resolveBarcode, resolveFood, resolveSearch, type CascadeTiers } from '../_shared/grounding/cascade.ts';

// Direct handler invocation (RESEARCH A7): the suite imports handler from
// index.ts and drives it with real Requests against the local stack.
const { url, anonKey, serviceRoleKey } = stackEnv();

const CACHE_KEY = 'search:chicken-rice';
const CACHE_PAYLOAD = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const GRAMS = 320;

let serviceClient: SupabaseClient | null = null;

function service(): SupabaseClient {
  if (serviceClient) return serviceClient;
  serviceClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return serviceClient;
}

let testUserId: string | null = null;
let accessToken: string | null = null;

async function authedUser(): Promise<{ userId: string; token: string }> {
  if (testUserId && accessToken) return { userId: testUserId, token: accessToken };
  const email = `e2e-${crypto.randomUUID()}@coachcal.test`;
  const password = 'e2e-known-password-1';
  const { data: created, error: createError } = await service().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !data.session) throw signInError ?? new Error('no session for test user');
  testUserId = created.user.id;
  accessToken = data.session.access_token;
  return { userId: testUserId, token: accessToken };
}

async function seedChickenRiceCache(): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: CACHE_KEY,
    source: 'fdc',
    payload: CACHE_PAYLOAD,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

function photoBody(scanId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { scanId, kind: 'photo', imageBase64: 'fixture-photo', mealType: 'lunch', ...overrides };
}

function scanRequest(body: unknown, token?: string): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/analyze-food', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function deleteScan(scanId: string, userId?: string): Promise<void> {
  const db = service();
  await db.from('scan_items').delete().eq('scan_id', scanId);
  await db.from('scans').delete().eq('id', scanId);
  await db.from('scan_usage').delete().eq('scan_id', scanId);
  if (userId) await db.from('scan_usage').delete().eq('user_id', userId);
}

Deno.test('analyze-food: photo scan returns computed kcal end-to-end', async () => {
  await seedChickenRiceCache();
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const res = await handler(scanRequest(photoBody(scanId), token));
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());

    assertEquals(parsed.scanId, scanId);
    assertEquals(parsed.kind, 'photo');
    assertEquals(parsed.items.length, 1);
    const item = parsed.items[0];
    // kcal comes from _shared/arithmetic.ts — the VLM contract has no kcal field.
    assertEquals(item.kcal, Math.round(CACHE_PAYLOAD.kcal * GRAMS / 100));
    assertEquals(item.kcal, 464);
    assertEquals(item.proteinG, Math.round(CACHE_PAYLOAD.proteinG * GRAMS / 10) / 10);
    assertEquals(item.carbsG, 128);
    assertEquals(item.fatG, 12.8);
    assertEquals(item.fiberG, 6.4);
    assertEquals(item.grams, GRAMS);
    assertEquals(item.source, 'cache');
    assertEquals(item.confidence, 0.92);
    assertEquals(item.hiddenFatLikely, false);
    assertEquals(item.unresolved, false);
    assertEquals(parsed.mealKcal, 464);
    assertEquals(parsed.scanConfidence, 0.92);
    assertEquals(parsed.note, null);

    const db = service();
    const scan = await db.from('scans').select('*').eq('id', scanId).maybeSingle();
    assert(scan.data, 'scans row must exist');
    assertEquals(scan.data.user_id, userId);
    assertEquals(scan.data.kind, 'photo');
    assertEquals(scan.data.meal_type, 'lunch');
    const items = await db.from('scan_items').select('*').eq('scan_id', scanId);
    assertEquals(items.data?.length, 1);
    assertEquals(items.data?.[0].kcal, 464);
    assertEquals(items.data?.[0].source, 'cache');
    const usage = await db.from('scan_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('scan_id', scanId);
    assertEquals(usage.count, 1);
  } finally {
    await deleteScan(scanId, userId);
  }
});

Deno.test('analyze-food: replaying the same scanId stays 200 with one scan_usage row', async () => {
  await seedChickenRiceCache();
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const first = await handler(scanRequest(photoBody(scanId), token));
    assertEquals(first.status, 200);
    assertEquals(ScanResponseSchema.parse(await first.json()).items[0].kcal, 464);

    // Retry-storm guard (Pitfall 7) proven at the handler layer, not just SQL.
    const replay = await handler(scanRequest(photoBody(scanId), token));
    assertEquals(replay.status, 200);
    assertEquals(ScanResponseSchema.parse(await replay.json()).items[0].kcal, 464);

    const db = service();
    const usage = await db.from('scan_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('scan_id', scanId);
    assertEquals(usage.count, 1);
    const scans = await db.from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', scanId);
    assertEquals(scans.count, 1);
    const items = await db.from('scan_items')
      .select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId);
    assertEquals(items.count, 1);
  } finally {
    await deleteScan(scanId, userId);
  }
});

Deno.test('analyze-food: malformed VLM output is a typed 422, never a 500', async () => {
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  const savedMode = Deno.env.get('VLM_FIXTURE_MODE');
  Deno.env.set('VLM_FIXTURE_MODE', 'malformed');
  try {
    const res = await handler(scanRequest(photoBody(scanId), token));
    assertEquals(res.status, 422);
    const body = await res.json();
    assertEquals(body.error.code, 'VLM_SCHEMA_ERROR');
    // zod 4 reports an unrecognized key at the object's path (items.0); the
    // no-kcal rejection itself is pinned in contracts.test.ts.
    assert(
      body.error.details.includes('items.0'),
      `issue paths must point at the offending item, got: ${JSON.stringify(body.error.details)}`,
    );
    const scans = await service().from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', scanId);
    assertEquals(scans.count, 0, 'nothing may persist past a 422');
  } finally {
    if (savedMode === undefined) Deno.env.delete('VLM_FIXTURE_MODE');
    else Deno.env.set('VLM_FIXTURE_MODE', savedMode);
    await deleteScan(scanId, userId);
  }
});

Deno.test('analyze-food: malformed request shapes are 400 VALIDATION_ERROR before auth', async () => {
  const badUuid = await handler(scanRequest(photoBody('not-a-uuid')));
  assertEquals(badUuid.status, 400);
  const badUuidBody = await badUuid.json();
  assertEquals(badUuidBody.error.code, 'VALIDATION_ERROR');
  assert(badUuidBody.error.details.some((detail: string) => detail.includes('scanId')));

  const kindMismatch = await handler(scanRequest({
    scanId: crypto.randomUUID(),
    kind: 'label',
    mealType: 'lunch',
  }));
  assertEquals(kindMismatch.status, 400);
  assertEquals((await kindMismatch.json()).error.code, 'VALIDATION_ERROR');

  const unknownKey = await handler(scanRequest(photoBody(crypto.randomUUID(), { mode: 'malformed' })));
  assertEquals(unknownKey.status, 400);
  assertEquals((await unknownKey.json()).error.code, 'VALIDATION_ERROR');
});

Deno.test('analyze-food: a missing Authorization header is a 401 envelope', async () => {
  const res = await handler(scanRequest(photoBody(crypto.randomUUID())));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
});

// Miss-tier stub keeps the live-DB pin hermetic — provider reachability is
// cascade.test.ts's job; these calls would otherwise hit FDC/OFF for real.
const missTiers: CascadeTiers = {
  fdc: {
    resolveBarcode: () => Promise.resolve({ kind: 'not_found' }),
    resolveSearch: () => Promise.resolve({ kind: 'not_found' }),
  },
  off: { resolveBarcode: () => Promise.resolve({ kind: 'not_found' }) },
  fatsecret: { resolveBarcode: () => Promise.resolve({ kind: 'not_found' }) },
};

Deno.test('cascade skeleton: delegates return cache hits and typed misses', async () => {
  await seedChickenRiceCache();
  try {
    const db = service();
    const hit = await resolveSearch(db, '  Chicken-Rice  ');
    assert('per100g' in hit, 'a live cache row must ground the search');
    assertEquals(hit.source, 'cache');
    assertEquals(hit.cacheKey, 'search:chicken-rice');
    assertEquals(hit.per100g.kcal, 145);

    const foodHit = await resolveFood(db, 'chicken-rice');
    assert('per100g' in foodHit);

    assertEquals(await resolveBarcode(db, '3017620422003', missTiers), { kind: 'not_found' });
    assertEquals(await resolveSearch(db, 'never-cached-item', missTiers), { kind: 'not_found' });
  } finally {
    const db = service();
    await db.from('food_cache').delete().eq('cache_key', CACHE_KEY);
    await db.from('food_cache').delete().eq('cache_key', 'barcode:3017620422003');
    await db.from('food_cache').delete().eq('cache_key', 'search:never-cached-item');
  }
});

Deno.test('analyze-food: suite cleanup removes the test user and cache seed', async () => {
  if (!testUserId) return;
  const db = service();
  await db.from('scan_usage').delete().eq('user_id', testUserId);
  await db.from('food_cache').delete().eq('cache_key', CACHE_KEY);
  await db.auth.admin.deleteUser(testUserId);
});
