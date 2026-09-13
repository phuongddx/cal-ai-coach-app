import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../analyze-food/index.ts';
import { stackEnv } from './_env.ts';
import { ScanResponseSchema } from '../_shared/contracts/scan.ts';
import { flagHiddenFat, HIDDEN_FAT_KEYWORDS } from '../_shared/hiddenFat.ts';

const { url, anonKey, serviceRoleKey } = stackEnv();

const CAESAR_KEY = 'search:caesar salad';
const TEXT_KEYS = [
  'search:grilled chicken',
  'search:greek salad',
  'search:banana',
  'search:greek yogurt',
];

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
  const email = `hidden-fat-${crypto.randomUUID()}@coachcal.test`;
  const password = 'hidden-fat-known-password-1';
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
  const { error: entError } = await service().from('entitlements').upsert({
    app_user_id: testUserId,
    supabase_user_id: testUserId,
    entitlement_id: 'coachcal_pro',
    active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (entError) throw entError;
  return { userId: testUserId, token: accessToken };
}

async function seedPositive(cacheKey: string, payload: Record<string, number>): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: cacheKey,
    source: 'fdc',
    payload,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

function scanRequest(body: unknown, token: string): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/analyze-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

Deno.test('flagHiddenFat fires on hidden-fat keywords across labels', () => {
  assertEquals(flagHiddenFat(['caesar dressing']), true);
  assertEquals(flagHiddenFat(['coconut oil']), true);
  assertEquals(flagHiddenFat(['Grilled Chicken with Olive Oil']), true, 'case-insensitive');
  assertEquals(flagHiddenFat(['pasta with heavy cream sauce']), true, 'multi-word keyword');
  assertEquals(flagHiddenFat(['sautéed spinach']), true, 'unicode keyword');
  assertEquals(flagHiddenFat(['deep-fried chicken']), true, 'hyphenated keyword');
  assertEquals(flagHiddenFat(['plain rice', 'butter naan']), true, 'any label firing is enough');
});

Deno.test('flagHiddenFat stays silent without whole-word keyword matches', () => {
  assertEquals(flagHiddenFat(['grilled chicken']), false);
  assertEquals(flagHiddenFat(['coin']), false, "'oil' must not match inside 'coin'");
  assertEquals(flagHiddenFat(['boiled eggs']), false, "'oil' must not match inside 'boiled'");
  assertEquals(flagHiddenFat(['plain rice', 'steamed broccoli']), false);
  assertEquals(flagHiddenFat([]), false);
});

Deno.test('HIDDEN_FAT_KEYWORDS is a frozen vocabulary including the core fats', () => {
  assert(Object.isFrozen(HIDDEN_FAT_KEYWORDS));
  for (const keyword of ['oil', 'olive oil', 'dressing', 'mayonnaise', 'butter', 'heavy cream', 'fried']) {
    assert(HIDDEN_FAT_KEYWORDS.includes(keyword), `vocabulary must include '${keyword}'`);
  }
});

Deno.test('caesar sentinel scan carries the fixture hidden-fat flag alongside editable kcal', async () => {
  await seedPositive(CAESAR_KEY, { kcal: 190, proteinG: 8, carbsG: 11, fatG: 14, fiberG: 2 });
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const res = await handler(scanRequest({
      scanId,
      kind: 'photo',
      imageBase64: 'fixture:caesar-salad',
      mealType: 'lunch',
    }, token));
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());
    assertEquals(parsed.items.length, 1);
    const item = parsed.items[0];
    assertEquals(item.label, 'caesar salad');
    assertEquals(item.hiddenFatLikely, true, 'fixture flag must reach the response');
    assertEquals(item.kcal, Math.round(190 * 250 / 100), 'computed kcal rides alongside the signal');
    assertEquals(item.kcal, 475);
    assertEquals(Number.isInteger(item.kcal), true);
    assertEquals(item.unresolved, false);

    const persisted = await service().from('scan_items').select('hidden_fat_likely').eq('scan_id', scanId);
    assertEquals(persisted.data?.[0].hidden_fat_likely, true, 'signal must persist');
  } finally {
    await deleteScan(scanId, userId);
    await service().from('food_cache').delete().eq('cache_key', CAESAR_KEY);
  }
});

Deno.test('server-side heuristic fires the signal from the text description alone', async () => {
  await seedPositive('search:grilled chicken', { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 });
  await seedPositive('search:greek salad', { kcal: 90, proteinG: 3, carbsG: 6, fatG: 6, fiberG: 2 });
  await seedPositive('search:banana', { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 });
  await seedPositive('search:greek yogurt', { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, fiberG: 0 });
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const res = await handler(scanRequest({
      scanId,
      kind: 'text',
      textDescription: 'banana and greek yogurt drizzled with honey',
      mealType: 'breakfast',
    }, token));
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());
    assert(parsed.items.length > 0);
    const item = parsed.items[0];
    assertEquals(item.hiddenFatLikely, true, 'heuristic on the description must fire the signal');
    assertEquals(item.kcal > 0, true, 'signal must not suppress the computed kcal');
    assertEquals(item.unresolved, false);
  } finally {
    await deleteScan(scanId, userId);
    for (const key of TEXT_KEYS) await service().from('food_cache').delete().eq('cache_key', key);
  }
});

Deno.test('hidden-fat suite cleanup removes the test user, entitlement, and seeds', async () => {
  if (!testUserId) return;
  const db = service();
  await db.from('scan_usage').delete().eq('user_id', testUserId);
  await db.from('entitlements').delete().eq('supabase_user_id', testUserId);
  await db.auth.admin.deleteUser(testUserId);
});
