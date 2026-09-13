import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../food-search/index.ts';
import { stackEnv } from './_env.ts';
import { GroundedFoodSchema } from '../_shared/contracts/food.ts';
import { fdcFetch } from '../_shared/grounding/fdc.ts';

// Direct handler invocation (RESEARCH A7): the suite drives the real
// food-search handler against the local stack with a real signed-in user.
// The FDC fetch seam carries a recording stub so every provider pass is
// observable and no outbound call ever leaves the machine (search grounds
// from FDC only — OFF has no search tier).
const { url, anonKey, serviceRoleKey } = stackEnv();

const CHEDDAR_KEY = 'search:cheddar';
const CHEDDAR_PAYLOAD = { kcal: 402, proteinG: 24.9, carbsG: 3.09, fatG: 33.14, fiberG: 0 };
const FDC_HIT_QUERY = 'manchego';
const FDC_HIT_KEY = `search:${FDC_HIT_QUERY}`;
const FDC_HIT_PAYLOAD = { kcal: 374, proteinG: 28.61, carbsG: 2.87, fatG: 30.28, fiberG: 0 };
const ZERO_HIT_QUERY = 'zzz-no-such-food';
const ZERO_HIT_KEY = `search:${ZERO_HIT_QUERY}`;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SeamLog {
  fdc: string[];
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
  const email = `food-search-${crypto.randomUUID()}@coachcal.test`;
  const password = 'food-search-known-password-1';
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

async function seedSearchCache(cacheKey: string, payload: Record<string, number>): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: cacheKey,
    source: 'fdc',
    payload,
    expires_at: new Date(Date.now() + 7 * DAY_MS).toISOString(),
  });
  if (error) throw error;
}

function searchRequest(query: unknown, token?: string, extraBody: Record<string, unknown> = {}): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/food-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, ...extraBody }),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Installs a recording stub on the FDC fetch seam for the duration of `run`:
// `body` is what the stub answers with (an empty search for a typed miss,
// a captured-shape hit for grounding), and every request URL is logged.
async function withFdcSeam<T>(log: SeamLog, body: unknown, run: () => Promise<T>): Promise<T> {
  const originalFdc = fdcFetch.impl;
  fdcFetch.impl = (url: string) => {
    log.fdc.push(url);
    return Promise.resolve(jsonResponse(body));
  };
  try {
    return await run();
  } finally {
    fdcFetch.impl = originalFdc;
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

Deno.test('food-search: a seeded cache row answers with zero provider calls', async () => {
  await seedSearchCache(CHEDDAR_KEY, CHEDDAR_PAYLOAD);
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [] };
  try {
    const res = await withFdcSeam(log, { foods: [] }, () => handler(searchRequest('cheddar', token)));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.results.length, 1);
    const grounded = GroundedFoodSchema.parse(body.results[0]);
    assertEquals(grounded.source, 'cache');
    assertEquals(grounded.cacheKey, CHEDDAR_KEY);
    assertEquals(grounded.per100g, CHEDDAR_PAYLOAD);
    assertEquals(log.fdc.length, 0, 'a cache hit must not reach FDC');
  } finally {
    await deleteCacheKey(CHEDDAR_KEY);
  }
});

Deno.test('food-search: an unseeded query grounds from fdc and writes a 7-day-TTL cache row', async () => {
  await deleteCacheKey(FDC_HIT_KEY);
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [] };
  const fdcHit = {
    foods: [
      {
        fdcId: 173427,
        description: 'Cheese, manchego',
        dataType: 'SR Legacy',
        foodNutrients: [
          { value: FDC_HIT_PAYLOAD.kcal, unitName: 'KCAL', nutrientId: 1008 },
          { value: FDC_HIT_PAYLOAD.proteinG, unitName: 'G', nutrientId: 1003 },
          { value: FDC_HIT_PAYLOAD.carbsG, unitName: 'G', nutrientId: 1005 },
          { value: FDC_HIT_PAYLOAD.fatG, unitName: 'G', nutrientId: 1004 },
          { value: FDC_HIT_PAYLOAD.fiberG, unitName: 'G', nutrientId: 1079 },
        ],
      },
    ],
  };
  try {
    const res = await withFdcSeam(log, fdcHit, () => handler(searchRequest(FDC_HIT_QUERY, token)));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.results.length, 1);
    const grounded = GroundedFoodSchema.parse(body.results[0]);
    assertEquals(grounded.source, 'fdc');
    assertEquals(grounded.cacheKey, FDC_HIT_KEY);
    assertEquals(grounded.per100g, FDC_HIT_PAYLOAD);
    assertEquals(log.fdc.length > 0, true, 'an unseeded query must reach FDC');

    const cached = await service().from('food_cache')
      .select('source, payload, expires_at')
      .eq('cache_key', FDC_HIT_KEY)
      .maybeSingle();
    assert(cached.data, 'the grounding must persist a cache row');
    assertEquals(cached.data.source, 'fdc');
    const expiresAt = new Date(cached.data.expires_at as string).getTime();
    assert(
      Math.abs(expiresAt - (Date.now() + 7 * DAY_MS)) < 60 * 1000,
      'search rows must expire within a minute of +7 days',
    );
  } finally {
    await deleteCacheKey(FDC_HIT_KEY);
  }
});

Deno.test('food-search: a zero-hit search is a typed 404 FOOD_NOT_FOUND', async () => {
  const { token } = await authedUser();
  const log: SeamLog = { fdc: [] };
  try {
    const res = await withFdcSeam(log, { foods: [] }, () => handler(searchRequest(ZERO_HIT_QUERY, token)));
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error.code, 'FOOD_NOT_FOUND');
    assertEquals(body.results === undefined, true, 'an empty 200 must never disguise a miss');
    assertEquals(log.fdc.length > 0, true, 'the zero-hit must have run the FDC tier');
  } finally {
    await deleteCacheKey(ZERO_HIT_KEY);
  }
});

Deno.test('food-search: empty and missing-auth requests are typed refusals', async () => {
  const empty = await handler(searchRequest(''));
  assertEquals(empty.status, 400);
  const emptyBody = await empty.json();
  assertEquals(emptyBody.error.code, 'VALIDATION_ERROR');
  assert(emptyBody.error.details.some((detail: string) => detail.includes('query')));

  const blank = await handler(searchRequest('   '));
  assertEquals(blank.status, 400);
  assertEquals((await blank.json()).error.code, 'VALIDATION_ERROR');

  const unknownKey = await handler(searchRequest('cheddar', undefined, { kind: 'text' }));
  assertEquals(unknownKey.status, 400);
  assertEquals((await unknownKey.json()).error.code, 'VALIDATION_ERROR');

  const unauthenticated = await handler(searchRequest('cheddar'));
  assertEquals(unauthenticated.status, 401);
  assertEquals((await unauthenticated.json()).error.code, 'UNAUTHORIZED');
});

Deno.test('food-search: lookups never consume scan quota', async () => {
  await seedSearchCache(CHEDDAR_KEY, CHEDDAR_PAYLOAD);
  const { userId, token } = await authedUser();
  const log: SeamLog = { fdc: [] };
  try {
    const hit = await withFdcSeam(log, { foods: [] }, () => handler(searchRequest('cheddar', token)));
    assertEquals(hit.status, 200);
    await hit.body?.cancel();
    const miss = await withFdcSeam(log, { foods: [] }, () => handler(searchRequest(ZERO_HIT_QUERY, token)));
    assertEquals(miss.status, 404);
    await miss.body?.cancel();
    const refused = await handler(searchRequest('', token));
    assertEquals(refused.status, 400);
    await refused.body?.cancel();

    assertEquals(await usageCount(userId), 0, 'lookup endpoints must be unmetered (TRU-02)');
  } finally {
    await deleteCacheKey(CHEDDAR_KEY);
    await deleteCacheKey(ZERO_HIT_KEY);
  }
});

Deno.test('food-search: suite cleanup removes the test user and cache seeds', async () => {
  if (!testUserId) return;
  await service().from('scan_usage').delete().eq('user_id', testUserId);
  await deleteCacheKey(CHEDDAR_KEY);
  await deleteCacheKey(FDC_HIT_KEY);
  await deleteCacheKey(ZERO_HIT_KEY);
  await service().auth.admin.deleteUser(testUserId);
});
