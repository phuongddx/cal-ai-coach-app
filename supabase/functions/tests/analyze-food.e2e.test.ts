import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../analyze-food/index.ts';
import { stackEnv } from './_env.ts';
import { ScanResponseSchema } from '../_shared/contracts/scan.ts';

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

Deno.test('analyze-food: a missing Authorization header is a 401 envelope', async () => {
  const res = await handler(scanRequest(photoBody(crypto.randomUUID())));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
});

Deno.test('analyze-food: suite cleanup removes the test user and cache seed', async () => {
  if (!testUserId) return;
  const db = service();
  await db.from('scan_usage').delete().eq('user_id', testUserId);
  await db.from('food_cache').delete().eq('cache_key', CACHE_KEY);
  await db.auth.admin.deleteUser(testUserId);
});
