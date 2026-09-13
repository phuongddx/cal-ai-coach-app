import { assert, assertEquals } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../analyze-food/index.ts';
import { stackEnv } from './_env.ts';
import { ScanResponseSchema } from '../_shared/contracts/scan.ts';
import {
  chooseTier,
  TIER1_MIN_ITEM_CONFIDENCE,
  TIER1_MIN_SCAN_CONFIDENCE,
} from '../_shared/routing.ts';
import {
  overrideVlmProvider,
  type VlmProvider,
  type VlmTier,
} from '../_shared/vlm/provider.ts';
import { FixtureProvider } from '../_shared/vlm/fixture.ts';
import type { VlmInput } from '../_shared/vlm/provider.ts';
import type { VlmOutput } from '../_shared/contracts/vlm.ts';

// Direct handler invocation (RESEARCH A7), same harness as the tracer suite.
const { url, anonKey, serviceRoleKey } = stackEnv();

const PROTEIN_BAR_KEY = 'search:protein bar';
const ALMONDS_KEY = 'search:roasted almonds';
const CHICKEN_RICE_KEY = 'search:chicken-rice';
const BARCODE_KEY = 'barcode:0036000291452';
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
  const email = `modes-${crypto.randomUUID()}@coachcal.test`;
  const password = 'modes-known-password-1';
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
  // This suite runs many scans per user: an active entitlement bypasses the
  // free-tier claim so mode behavior is testable past the 3-scan window.
  await grantEntitlement(testUserId);
  return { userId: testUserId, token: accessToken };
}

async function grantEntitlement(userId: string): Promise<void> {
  const { error } = await service().from('entitlements').upsert({
    app_user_id: userId,
    supabase_user_id: userId,
    entitlement_id: 'coachcal_pro',
    active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
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

// The exact row shape the cascade itself writes after an all-tiers miss —
// seeding it keeps grounding-miss states hermetic (no live FDC/OFF calls).
async function seedNegative(cacheKey: string): Promise<void> {
  const { error } = await service().from('food_cache').upsert({
    cache_key: cacheKey,
    source: 'negative',
    payload: { notFound: true },
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

async function deleteCacheKey(cacheKey: string): Promise<void> {
  await service().from('food_cache').delete().eq('cache_key', cacheKey);
}

function scanBody(scanId: string, kind: string, payload: Record<string, unknown>): Record<string, unknown> {
  return { scanId, kind, mealType: 'lunch', ...payload };
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

function countingProvider(): { provider: VlmProvider; calls: () => number; tiers: () => VlmTier[] } {
  const real = new FixtureProvider();
  let calls = 0;
  const seenTiers: VlmTier[] = [];
  return {
    provider: {
      analyze: (input: VlmInput, tier: VlmTier) => {
        calls += 1;
        seenTiers.push(tier);
        return real.analyze(input, tier);
      },
    },
    calls: () => calls,
    tiers: () => [...seenTiers],
  };
}

Deno.test('routing: chooseTier escalates below the tier1 confidence floors', () => {
  assertEquals(TIER1_MIN_SCAN_CONFIDENCE, 0.7);
  assertEquals(TIER1_MIN_ITEM_CONFIDENCE, 0.5);

  const atThresholds: VlmOutput = { isFood: true, items: [{ label: 'x', grams: 100, gramsBasis: 'estimated', confidence: 0.5, hiddenFatLikely: false }], scanConfidence: 0.7, note: null };
  assertEquals(chooseTier(atThresholds), 'tier1', 'thresholds are inclusive floors');

  const lowScan: VlmOutput = { ...atThresholds, scanConfidence: 0.69 };
  assertEquals(chooseTier(lowScan), 'tier2');

  const lowItem: VlmOutput = { isFood: true, items: [{ label: 'x', grams: 100, gramsBasis: 'estimated', confidence: 0.49, hiddenFatLikely: false }], scanConfidence: 0.95, note: null };
  assertEquals(chooseTier(lowItem), 'tier2');
});

Deno.test('label scan grounds per-serving packaged values through the arithmetic path', async () => {
  await seedPositive(PROTEIN_BAR_KEY, { kcal: 400, proteinG: 30, carbsG: 40, fatG: 15, fiberG: 8 });
  await seedNegative(ALMONDS_KEY);
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const res = await handler(
      scanRequest(scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }), token),
    );
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());
    assertEquals(parsed.kind, 'label');
    assertEquals(parsed.items.length, 2);

    const bar = parsed.items[0];
    assertEquals(bar.label, 'protein bar');
    assertEquals(bar.gramsBasis, 'packaged-serving');
    assertEquals(bar.kcal, Math.round(400 * 60 / 100));
    assertEquals(bar.kcal, 240);
    assertEquals(bar.source, 'cache');
    assertEquals(bar.unresolved, false);

    const almonds = parsed.items[1];
    assertEquals(almonds.label, 'roasted almonds');
    assertEquals(almonds.unresolved, true);
    assertEquals(almonds.kcal, 0);
    assertEquals(almonds.source, 'none');
    assertEquals(parsed.mealKcal, 240);
  } finally {
    await deleteScan(scanId, userId);
    await deleteCacheKey(PROTEIN_BAR_KEY);
    await deleteCacheKey(ALMONDS_KEY);
  }
});

Deno.test('label scan with every item unresolved is a typed 404, never a guess', async () => {
  await seedNegative(PROTEIN_BAR_KEY);
  await seedNegative(ALMONDS_KEY);
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  try {
    const res = await handler(
      scanRequest(scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }), token),
    );
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error.code, 'FOOD_NOT_FOUND');
    const scans = await service().from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('id', scanId);
    assertEquals(scans.count, 0, 'a 404 must not persist a scan');
  } finally {
    await deleteScan(scanId, userId);
    await deleteCacheKey(PROTEIN_BAR_KEY);
    await deleteCacheKey(ALMONDS_KEY);
  }
});

Deno.test('text scan is deterministic byte-for-byte across identical descriptions', async () => {
  await seedPositive('search:grilled chicken', { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 });
  await seedPositive('search:greek salad', { kcal: 90, proteinG: 3, carbsG: 6, fatG: 6, fiberG: 2 });
  await seedPositive('search:banana', { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 });
  await seedPositive('search:greek yogurt', { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, fiberG: 0 });
  const { userId, token } = await authedUser();
  const firstId = crypto.randomUUID();
  const secondId = crypto.randomUUID();
  const description = 'hearty grilled chicken bowl with greens';
  try {
    const first = await handler(
      scanRequest(scanBody(firstId, 'text', { textDescription: description }), token),
    );
    assertEquals(first.status, 200);
    const second = await handler(
      scanRequest(scanBody(secondId, 'text', { textDescription: description }), token),
    );
    assertEquals(second.status, 200);
    const firstParsed = ScanResponseSchema.parse(await first.json());
    const secondParsed = ScanResponseSchema.parse(await second.json());

    assertEquals(
      JSON.stringify(firstParsed.items),
      JSON.stringify(secondParsed.items),
      'identical text must yield byte-identical item lists',
    );
    assert(firstParsed.items.length > 0);
    assertEquals(firstParsed.items[0].unresolved, false);
    const item = firstParsed.items[0];
    assertEquals(item.kcal, Math.round(item.per100g.kcal * item.grams / 100));
  } finally {
    await deleteScan(firstId, userId);
    await deleteScan(secondId, userId);
    for (const key of TEXT_KEYS) await deleteCacheKey(key);
  }
});

Deno.test('escalate sentinel re-runs exactly once at tier2 and tier2 wins', async () => {
  await seedPositive(CHICKEN_RICE_KEY, { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 });
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  const counted = countingProvider();
  overrideVlmProvider(counted.provider);
  try {
    const res = await handler(
      scanRequest(scanBody(scanId, 'photo', { imageBase64: 'fixture:escalate' }), token),
    );
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());
    assertEquals(counted.calls(), 2, 'escalation is exactly two provider calls');
    assertEquals(counted.tiers(), ['tier1', 'tier2']);
    assertEquals(parsed.scanConfidence, 0.95, 'the tier2 output is authoritative');
    assertEquals(parsed.note, 'tier2 escalation');
    assertEquals(parsed.items[0].kcal, 464);
  } finally {
    overrideVlmProvider(null);
    await deleteScan(scanId, userId);
    await deleteCacheKey(CHICKEN_RICE_KEY);
  }
});

Deno.test('barcode scan performs zero VLM calls and grounds exact cache data', async () => {
  await seedPositive(BARCODE_KEY, { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 });
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  const counted = countingProvider();
  overrideVlmProvider(counted.provider);
  try {
    const res = await handler(
      scanRequest(scanBody(scanId, 'barcode', { barcode: '0036000291452' }), token),
    );
    assertEquals(res.status, 200);
    const parsed = ScanResponseSchema.parse(await res.json());
    assertEquals(counted.calls(), 0, 'the barcode path must bypass the VLM entirely');
    assertEquals(parsed.items.length, 1);
    assertEquals(parsed.items[0].source, 'cache');
    assertEquals(parsed.items[0].kcal, 539);
    assertEquals(parsed.items[0].unresolved, false);
    assertEquals(parsed.scanConfidence, 1, 'exact DB data carries full confidence, no VLM estimate');
  } finally {
    overrideVlmProvider(null);
    await deleteScan(scanId, userId);
    await deleteCacheKey(BARCODE_KEY);
  }
});

Deno.test('malformed fixture mode over the label path is a typed 422, never a 500', async () => {
  const { userId, token } = await authedUser();
  const scanId = crypto.randomUUID();
  const savedMode = Deno.env.get('VLM_FIXTURE_MODE');
  Deno.env.set('VLM_FIXTURE_MODE', 'malformed');
  try {
    const res = await handler(
      scanRequest(scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }), token),
    );
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
  }
});

Deno.test('modes suite cleanup removes the test user, entitlement, and cache seeds', async () => {
  if (!testUserId) return;
  const db = service();
  await db.from('scan_usage').delete().eq('user_id', testUserId);
  await db.from('entitlements').delete().eq('supabase_user_id', testUserId);
  for (const key of [PROTEIN_BAR_KEY, ALMONDS_KEY, CHICKEN_RICE_KEY, BARCODE_KEY, ...TEXT_KEYS]) {
    await db.from('food_cache').delete().eq('cache_key', key);
  }
  await db.auth.admin.deleteUser(testUserId);
});
