import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../barcode-resolve/index.ts';
import { stackEnv } from './_env.ts';
import { GroundedFoodSchema } from '../_shared/contracts/food.ts';
import { fdcFetch } from '../_shared/grounding/fdc.ts';
import { offFetch } from '../_shared/grounding/off.ts';

// Direct handler invocation (RESEARCH A7): the suite drives the real
// barcode-resolve handler against the local stack with a real signed-in
// user. Provider fetch seams carry recording all-miss stubs so every
// provider pass is observable and no outbound call ever leaves the machine.
const { url, anonKey, serviceRoleKey } = stackEnv();

const BARCODE = '3017620422003';
const BARCODE_KEY = `barcode:${BARCODE}`;
const BARCODE_PAYLOAD = { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 };
const UNKNOWN_BARCODE = '9999999999999';
const UNKNOWN_BARCODE_KEY = `barcode:${UNKNOWN_BARCODE}`;

interface SeamLog {
  fdc: string[];
  off: string[];
}

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
  const email = `barcode-resolve-${crypto.randomUUID()}@coachcal.test`;
  const password = 'barcode-resolve-known-password-1';
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

async function seedBarcodeCache(): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: BARCODE_KEY,
    source: 'fdc',
    payload: BARCODE_PAYLOAD,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

function lookupRequest(barcode: unknown, token?: string, extraBody: Record<string, unknown> = {}): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/barcode-resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ barcode, ...extraBody }),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Installs recording all-miss stubs on both fetch seams for the duration of
// `run`: FDC answers an empty Branded search, OFF a status-0 body — an
// unexpected provider pass yields a typed miss, never a live network call.
async function withMissSeams<T>(log: SeamLog, run: () => Promise<T>): Promise<T> {
  const originalFdc = fdcFetch.impl;
  const originalOff = offFetch.impl;
  fdcFetch.impl = (url: string) => {
    log.fdc.push(url);
    return Promise.resolve(jsonResponse({ foods: [] }));
  };
  offFetch.impl = (url: string) => {
    log.off.push(url);
    return Promise.resolve(jsonResponse({ status: 0 }));
  };
  try {
    return await run();
  } finally {
    fdcFetch.impl = originalFdc;
    offFetch.impl = originalOff;
  }
}

async function deleteCacheKey(cacheKey: string): Promise<void> {
  await service().from('food_cache').delete().eq('cache_key', cacheKey);
}

async function usageCount(userId: string): Promise<number> {
  const { count } = await service().from('scan_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

Deno.test('barcode-resolve: a seeded-cache barcode answers from cache with zero provider calls', async () => {
  await seedBarcodeCache();
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [], off: [] };
  try {
    const res = await withMissSeams(log, () => handler(lookupRequest(BARCODE, token)));
    assertEquals(res.status, 200);
    const body = GroundedFoodSchema.parse(await res.json());
    assertEquals(body.source, 'cache');
    assertEquals(body.cacheKey, BARCODE_KEY);
    assertEquals(body.per100g, BARCODE_PAYLOAD);
    assertEquals(log.fdc.length, 0, 'a cache hit must not reach FDC');
    assertEquals(log.off.length, 0, 'a cache hit must not reach OFF');
  } finally {
    await deleteCacheKey(BARCODE_KEY);
  }
});

Deno.test('barcode-resolve: an unknown barcode with all-miss tiers is a typed 404, never a guess', async () => {
  await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [], off: [] };
  try {
    const res = await withMissSeams(log, () => handler(lookupRequest(UNKNOWN_BARCODE, token)));
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error.code, 'BARCODE_NOT_FOUND');
    assertEquals(body.per100g === undefined, true, 'no fabricated nutrition fields');
    assertEquals(body.source === undefined, true, 'no fabricated source attribution');
    assertEquals(log.fdc.length > 0, true, 'the miss must have run the provider tiers');
    assertEquals(log.off.length > 0, true, 'the miss must have run the OFF tier');
  } finally {
    await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  }
});

Deno.test('barcode-resolve: malformed request shapes are 400 VALIDATION_ERROR', async () => {
  const nonDigit = await handler(lookupRequest('12abc34'));
  assertEquals(nonDigit.status, 400);
  const nonDigitBody = await nonDigit.json();
  assertEquals(nonDigitBody.error.code, 'VALIDATION_ERROR');
  assert(nonDigitBody.error.details.some((detail: string) => detail.includes('barcode')));

  // 10 digits is contract-invalid: the normalizer has no EAN-13 form for it,
  // so it must be refused at the boundary, never reach the cascade.
  const wrongLength = await handler(lookupRequest('1234567890'));
  assertEquals(wrongLength.status, 400);
  assertEquals((await wrongLength.json()).error.code, 'VALIDATION_ERROR');

  const unknownKey = await handler(lookupRequest('123456789', undefined, { kind: 'barcode' }));
  assertEquals(unknownKey.status, 400);
  assertEquals((await unknownKey.json()).error.code, 'VALIDATION_ERROR');

  const notJson = await handler(new Request('http://127.0.0.1:54321/functions/v1/barcode-resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  }));
  assertEquals(notJson.status, 400);
  assertEquals((await notJson.json()).error.code, 'VALIDATION_ERROR');
});

Deno.test('barcode-resolve: a missing Authorization header is a 401 envelope', async () => {
  const res = await handler(lookupRequest(BARCODE));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error.code, 'UNAUTHORIZED');
});

Deno.test('barcode-resolve: lookups never consume scan quota', async () => {
  await seedBarcodeCache();
  const { userId, token } = await authedUser();
  const log: SeamLog = { fdc: [], off: [] };
  try {
    const hit = await withMissSeams(log, () => handler(lookupRequest(BARCODE, token)));
    assertEquals(hit.status, 200);
    await hit.body?.cancel();
    const miss = await withMissSeams(log, () => handler(lookupRequest(UNKNOWN_BARCODE, token)));
    assertEquals(miss.status, 404);
    await miss.body?.cancel();
    const refused = await handler(lookupRequest('12abc34', token));
    assertEquals(refused.status, 400);
    await refused.body?.cancel();

    assertEquals(await usageCount(userId), 0, 'lookup endpoints must be unmetered (TRU-02)');
  } finally {
    await deleteCacheKey(BARCODE_KEY);
    await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  }
});

Deno.test('barcode-resolve: a miss caches negatively for 24h and the second lookup performs zero provider fetches', async () => {
  await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [], off: [] };
  try {
    const first = await withMissSeams(log, () => handler(lookupRequest(UNKNOWN_BARCODE, token)));
    assertEquals(first.status, 404);
    await first.body?.cancel();
    const firstPassFetches = log.fdc.length + log.off.length;
    assertEquals(firstPassFetches > 0, true, 'the first miss must reach the providers');

    const second = await withMissSeams(log, () => handler(lookupRequest(UNKNOWN_BARCODE, token)));
    assertEquals(second.status, 404);
    await second.body?.cancel();

    assertEquals(
      log.fdc.length + log.off.length,
      firstPassFetches,
      'the second lookup must be served by the 24h negative row, zero fetches',
    );
    const negative = await service().from('food_cache')
      .select('source, expires_at')
      .eq('cache_key', UNKNOWN_BARCODE_KEY)
      .maybeSingle();
    assertEquals(negative.data?.source, 'negative');
    const expiresAt = new Date(negative.data!.expires_at as string).getTime();
    assert(
      Math.abs(expiresAt - (Date.now() + 24 * 60 * 60 * 1000)) < 60 * 1000,
      'negative rows must expire within a minute of +24h',
    );
  } finally {
    await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  }
});

Deno.test('barcode-resolve: suite cleanup removes the test user and cache seeds', async () => {
  if (!testUserId) return;
  await service().from('scan_usage').delete().eq('user_id', testUserId);
  await deleteCacheKey(BARCODE_KEY);
  await deleteCacheKey(UNKNOWN_BARCODE_KEY);
  await service().auth.admin.deleteUser(testUserId);
});
