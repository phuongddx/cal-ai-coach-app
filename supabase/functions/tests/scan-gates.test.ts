import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../analyze-food/index.ts';
import { stackEnv } from './_env.ts';
import { ScanResponseSchema } from '../_shared/contracts/scan.ts';
import { ErrorEnvelopeSchema } from '../_shared/contracts/errors.ts';

// Gate-order e2e (RESEARCH A7): quota claim, entitlement bypass/expiry, typed
// barcode not-found, and the schema-error boundary — all against the real
// handler with a real signed-in user.
const { url, anonKey, serviceRoleKey } = stackEnv();

const CHICKEN_RICE_KEY = 'search:chicken-rice';
const CHICKEN_RICE_PAYLOAD = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const BARCODE = '0036000291452';
const BARCODE_KEY = `barcode:${BARCODE}`;
// Suite-scoped barcode keys: barcode-resolve.test.ts owns 9999999999999, so
// a shared one would race that suite's negative-caching assertions.
const UNKNOWN_BARCODE = '8888888888888';
const UNKNOWN_BARCODE_KEY = `barcode:${UNKNOWN_BARCODE}`;

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
  const email = `scan-gates-${crypto.randomUUID()}@coachcal.test`;
  const password = 'scan-gates-known-password-1';
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

async function seedPositive(cacheKey: string, payload: Record<string, number>): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: cacheKey,
    source: 'fdc',
    payload,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

// The row the cascade itself writes after an all-tiers miss — seeding it keeps
// the unknown-barcode case hermetic (zero live FDC/OFF calls).
async function seedNegative(cacheKey: string): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: cacheKey,
    source: 'negative',
    payload: { notFound: true },
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

async function seedChickenRice(): Promise<void> {
  await seedPositive(CHICKEN_RICE_KEY, CHICKEN_RICE_PAYLOAD);
}

async function grantEntitlement(userId: string, expiresAtIso: string): Promise<void> {
  const { error } = await service().from('entitlements').upsert({
    app_user_id: userId,
    supabase_user_id: userId,
    entitlement_id: 'coachcal_pro',
    active: true,
    expires_at: expiresAtIso,
  });
  if (error) throw error;
}

async function removeEntitlement(userId: string): Promise<void> {
  await service().from('entitlements').delete().eq('supabase_user_id', userId);
}

function photoBody(scanId: string): Record<string, unknown> {
  return { scanId, kind: 'photo', imageBase64: 'fixture-photo', mealType: 'lunch' };
}

function barcodeBody(scanId: string, barcode: string): Record<string, unknown> {
  return { scanId, kind: 'barcode', barcode, mealType: 'lunch' };
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

async function usageCount(userId: string): Promise<number> {
  const { count } = await service().from('scan_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

Deno.test('quota: the 4th free-tier scan in the window is a 402 with entitlement state', async () => {
  await seedChickenRice();
  const { userId, token } = await authedUser();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  try {
    for (const scanId of ids.slice(0, 3)) {
      const res = await handler(scanRequest(photoBody(scanId), token));
      assertEquals(res.status, 200, `scan ${scanId} should consume a credit`);
      await res.body?.cancel();
    }

    const fourth = await handler(scanRequest(photoBody(ids[3]), token));
    assertEquals(fourth.status, 402);
    const envelope = ErrorEnvelopeSchema.parse(await fourth.json());
    assertEquals(envelope.error.code, 'FREE_LIMIT_REACHED');
    const entitlement = envelope.error.entitlement;
  assert(entitlement, 'the 402 body must carry entitlement state');
    assertEquals(entitlement.tier, 'free');
    assertEquals(entitlement.scansUsed, 3);
    assertEquals(entitlement.scanLimit, 3);
    assertEquals(Number.isNaN(new Date(entitlement.windowResetAt).getTime()), false);
    assertEquals(
      new Date(entitlement.windowResetAt).getTime() > Date.now(),
      true,
      'the window reset must lie in the future',
    );
    const scans = await service().from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', ids[3]);
    assertEquals(scans.count, 0, 'a 402 must not persist a scan');
  } finally {
    for (const scanId of ids) await deleteScan(scanId, userId);
  }
});

Deno.test('quota: replaying a consumed scanId after the limit stays 200 with exactly 3 usage rows', async () => {
  await seedChickenRice();
  const { userId, token } = await authedUser();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  try {
    for (const scanId of ids.slice(0, 3)) {
      const res = await handler(scanRequest(photoBody(scanId), token));
      assertEquals(res.status, 200);
      await res.body?.cancel();
    }
    const fourth = await handler(scanRequest(photoBody(ids[3]), token));
    assertEquals(fourth.status, 402);
    await fourth.body?.cancel();

    const replay = await handler(scanRequest(photoBody(ids[2]), token));
    assertEquals(replay.status, 200, 'an earlier consumed scanId replays idempotently');
    assertEquals(ScanResponseSchema.parse(await replay.json()).items[0].kcal, 464);

    assertEquals(await usageCount(userId), 3, 'the replay must not grow usage');
  } finally {
    for (const scanId of ids) await deleteScan(scanId, userId);
  }
});

Deno.test('entitlement: an active entitlement bypasses the claim; an expired one does not', async () => {
  await seedChickenRice();
  const { userId, token } = await authedUser();
  const freeIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const bypassId = crypto.randomUUID();
  const afterExpiryId = crypto.randomUUID();
  try {
    // Exhaust the free window first so the bypass is proven against a
    // would-be 402, not a user with quota to spare.
    for (const scanId of freeIds) {
      const res = await handler(scanRequest(photoBody(scanId), token));
      assertEquals(res.status, 200);
      await res.body?.cancel();
    }
    assertEquals(await usageCount(userId), 3);

    await grantEntitlement(userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const bypass = await handler(scanRequest(photoBody(bypassId), token));
    assertEquals(bypass.status, 200, 'an entitled user skips the exhausted quota gate');
    await bypass.body?.cancel();
    const { count: bypassUsage } = await service().from('scan_usage')
      .select('*', { count: 'exact', head: true })
      .eq('scan_id', bypassId);
    assertEquals(bypassUsage, 0, 'entitled scans never touch scan_usage');

    // Same row, active still true — expiry is enforced by expires_at alone.
    await grantEntitlement(userId, new Date(Date.now() - 60 * 1000).toISOString());
    const afterExpiry = await handler(scanRequest(photoBody(afterExpiryId), token));
    assertEquals(afterExpiry.status, 402, 'an expired entitlement must fall back to the quota gate');
    assertEquals((await afterExpiry.json()).error.code, 'FREE_LIMIT_REACHED');
  } finally {
    for (const scanId of freeIds) await deleteScan(scanId, userId);
    await deleteScan(bypassId, userId);
    await deleteScan(afterExpiryId, userId);
    await removeEntitlement(userId);
  }
});

Deno.test('barcode gates: seeded cache resolves exactly; unknown barcode is a typed 404', async () => {
  await seedPositive(BARCODE_KEY, { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 });
  await seedNegative(UNKNOWN_BARCODE_KEY);
  const { userId, token } = await authedUser();
  await grantEntitlement(userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const knownId = crypto.randomUUID();
  const unknownId = crypto.randomUUID();
  try {
    const known = await handler(scanRequest(barcodeBody(knownId, BARCODE), token));
    assertEquals(known.status, 200);
    const knownParsed = ScanResponseSchema.parse(await known.json());
    assertEquals(knownParsed.items[0].source, 'cache');
    assertEquals(knownParsed.items[0].kcal, 539);
    assertEquals(knownParsed.items[0].unresolved, false);

    const unknown = await handler(scanRequest(barcodeBody(unknownId, UNKNOWN_BARCODE), token));
    assertEquals(unknown.status, 404);
    const unknownBody = await unknown.json();
    assertEquals(unknownBody.error.code, 'BARCODE_NOT_FOUND');
    assertEquals(unknownBody.items === undefined, true, 'no fabricated nutrition fields');
    const persisted = await service().from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', unknownId);
    assertEquals(persisted.count, 0, 'a 404 must not persist a scan');
  } finally {
    await deleteScan(knownId, userId);
    await deleteScan(unknownId, userId);
    await service().from('food_cache').delete().eq('cache_key', BARCODE_KEY);
    await service().from('food_cache').delete().eq('cache_key', UNKNOWN_BARCODE_KEY);
    await removeEntitlement(userId);
  }
});

Deno.test('malformed fixture mode is a typed 422 with the env restored afterward', async () => {
  await seedChickenRice();
  const { userId, token } = await authedUser();
  await grantEntitlement(userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const scanId = crypto.randomUUID();
  const savedMode = Deno.env.get('VLM_FIXTURE_MODE');
  Deno.env.set('VLM_FIXTURE_MODE', 'malformed');
  try {
    const res = await handler(scanRequest(photoBody(scanId), token));
    assertEquals(res.status, 422);
    const body = await res.json();
    assertEquals(body.error.code, 'VLM_SCHEMA_ERROR');
    assert(
      body.error.details.includes('items.0'),
      `issue paths must name the offending item, got: ${JSON.stringify(body.error.details)}`,
    );
    const scans = await service().from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', scanId);
    assertEquals(scans.count, 0, 'nothing may persist past a 422');
  } finally {
    if (savedMode === undefined) Deno.env.delete('VLM_FIXTURE_MODE');
    else Deno.env.set('VLM_FIXTURE_MODE', savedMode);
    await deleteScan(scanId, userId);
    await removeEntitlement(userId);
  }
});

Deno.test('scan-gates suite cleanup removes the test user and cache seeds', async () => {
  if (!testUserId) return;
  const db = service();
  await db.from('scan_usage').delete().eq('user_id', testUserId);
  await db.from('food_cache').delete().eq('cache_key', CHICKEN_RICE_KEY);
  await db.from('food_cache').delete().eq('cache_key', BARCODE_KEY);
  await db.from('food_cache').delete().eq('cache_key', UNKNOWN_BARCODE_KEY);
  await db.auth.admin.deleteUser(testUserId);
});
