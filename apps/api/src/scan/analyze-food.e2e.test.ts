import { ScanResponseSchema } from '@coachcal/api-contract';

import goldenRequest from '../../../../packages/api-contract/golden/scan-request-photo.golden.json';
import goldenResponse from '../../../../packages/api-contract/golden/scan-response-200.golden.json';
import { dbCacheStore } from '../grounding/cacheStore';
import {
  resolveBarcode,
  resolveFood,
  resolveSearch,
  type CascadeTiers,
} from '../grounding/cascade';
import { fdcFetch } from '../grounding/fdc';
import { describeSql, setEnv } from '../testing/sqlHarness';

// The suite drives the real POST /v1/scan route (app.request) against the local PostgreSQL 17.
const CACHE_KEY = 'search:chicken-rice';
const CACHE_PAYLOAD = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const GRAMS = 320;

function photoBody(scanId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { scanId, kind: 'photo', imageBase64: 'fixture-photo', mealType: 'lunch', ...overrides };
}

// Miss-tier stub keeps the live-DB pin hermetic — provider reachability is cascade.test.ts's
// job; these calls would otherwise hit FDC/OFF for real.
const missTiers: CascadeTiers = {
  fdc: {
    resolveBarcode: () => Promise.resolve({ kind: 'not_found' }),
    resolveSearch: () => Promise.resolve({ kind: 'not_found' }),
  },
  off: { resolveBarcode: () => Promise.resolve({ kind: 'not_found' }) },
  fatsecret: { resolveBarcode: () => Promise.resolve({ kind: 'not_found' }) },
};

describeSql('analyze-food e2e (SQL-backed)', (harness) => {
  it('analyze-food: photo scan returns computed kcal end-to-end', async () => {
    const h = harness();
    await h.seedPositive(CACHE_KEY, CACHE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const scanId = crypto.randomUUID();
    try {
      const res = await h.post('/v1/scan', photoBody(scanId), token);
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());

      expect(parsed.scanId).toBe(scanId);
      expect(parsed.kind).toBe('photo');
      expect(parsed.items.length).toBe(1);
      const item = parsed.items[0]!;
      // kcal comes from the canonical arithmetic — the VLM contract has no kcal field.
      expect(item.kcal).toBe(Math.round((CACHE_PAYLOAD.kcal * GRAMS) / 100));
      expect(item.kcal).toBe(464);
      expect(item.proteinG).toBe(Math.round((CACHE_PAYLOAD.proteinG * GRAMS) / 10) / 10);
      expect(item.carbsG).toBe(128);
      expect(item.fatG).toBe(12.8);
      expect(item.fiberG).toBe(6.4);
      expect(item.grams).toBe(GRAMS);
      expect(item.source).toBe('cache');
      expect(item.confidence).toBe(0.92);
      expect(item.hiddenFatLikely).toBe(false);
      expect(item.unresolved).toBe(false);
      expect(parsed.mealKcal).toBe(464);
      expect(parsed.scanConfidence).toBe(0.92);
      expect(parsed.note).toBeNull();

      expect(await h.scanCount(scanId)).toBe(1); // scans row must exist
      const rows = await h.owner<{ user_id: string; kind: string; meal_type: string }[]>`
        SELECT user_id, kind, meal_type FROM public.scans WHERE id = ${scanId}::uuid`;
      expect(rows[0]?.user_id).toBe(userId);
      expect(rows[0]?.kind).toBe('photo');
      expect(rows[0]?.meal_type).toBe('lunch');
      const items = await h.scanItems(scanId);
      expect(items.length).toBe(1);
      expect(items[0]?.kcal).toBe(464);
      expect(items[0]?.source).toBe('cache');
      expect(await h.usageCountForScan(scanId)).toBe(1);
    } finally {
      await h.deleteScan(scanId, userId);
    }
  });

  it('analyze-food: replaying the same scanId stays 200 with one scan_usage row', async () => {
    const h = harness();
    await h.seedPositive(CACHE_KEY, CACHE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const scanId = crypto.randomUUID();
    try {
      const first = await h.post('/v1/scan', photoBody(scanId), token);
      expect(first.status).toBe(200);
      expect(ScanResponseSchema.parse(await first.json()).items[0]?.kcal).toBe(464);

      // Retry-storm guard (Pitfall 7) proven at the route layer, not just SQL.
      const replay = await h.post('/v1/scan', photoBody(scanId), token);
      expect(replay.status).toBe(200);
      expect(ScanResponseSchema.parse(await replay.json()).items[0]?.kcal).toBe(464);

      expect(await h.usageCountForScan(scanId)).toBe(1);
      expect(await h.scanCount(scanId)).toBe(1);
      expect((await h.scanItems(scanId)).length).toBe(1);
    } finally {
      await h.deleteScan(scanId, userId);
    }
  });

  it('analyze-food: malformed VLM output is a typed 422, never a 500', async () => {
    const h = harness();
    const { userId, token } = await h.newUser();
    const scanId = crypto.randomUUID();
    const restoreEnv = setEnv({ VLM_FIXTURE_MODE: 'malformed' });
    try {
      const res = await h.post('/v1/scan', photoBody(scanId), token);
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string; details: string[] } };
      expect(body.error.code).toBe('VLM_SCHEMA_ERROR');
      // zod 4 reports an unrecognized key at the object's path (items.0); the no-kcal
      // rejection itself is pinned in contracts.test.ts.
      expect(body.error.details).toContain('items.0');
      expect(await h.scanCount(scanId)).toBe(0); // nothing may persist past a 422
    } finally {
      restoreEnv();
      await h.deleteScan(scanId, userId);
    }
  });

  it('analyze-food: an upstream provider outage is a retryable 502, never a bare 500', async () => {
    const h = harness();
    const { userId, token } = await h.newUser();
    const scanId = crypto.randomUUID();
    const originalFdc = fdcFetch.impl;
    fdcFetch.impl = () => Promise.resolve(new Response('service unavailable', { status: 503 }));
    try {
      // Clear the fixture label's cache row (earlier tests in this file seed it): the lookup
      // must reach the FDC tier and hit the outage there, after the quota claim has run.
      await h.deleteCacheKey(CACHE_KEY);
      const res = await h.post('/v1/scan', photoBody(scanId), token);
      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UPSTREAM_ERROR');
      expect(await h.scanCount(scanId)).toBe(0); // a 502 must not persist a scan
    } finally {
      fdcFetch.impl = originalFdc;
      await h.deleteScan(scanId, userId);
    }
  });

  it('analyze-food: malformed request shapes are 400 VALIDATION_ERROR before auth', async () => {
    const h = harness();
    const badUuid = await h.post('/v1/scan', photoBody('not-a-uuid'));
    expect(badUuid.status).toBe(400);
    const badUuidBody = (await badUuid.json()) as { error: { code: string; details: string[] } };
    expect(badUuidBody.error.code).toBe('VALIDATION_ERROR');
    expect(badUuidBody.error.details.some((detail) => detail.includes('scanId'))).toBe(true);

    const kindMismatch = await h.post('/v1/scan', {
      scanId: crypto.randomUUID(),
      kind: 'label',
      mealType: 'lunch',
    });
    expect(kindMismatch.status).toBe(400);
    expect(((await kindMismatch.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const unknownKey = await h.post('/v1/scan', photoBody(crypto.randomUUID(), { mode: 'malformed' }));
    expect(unknownKey.status).toBe(400);
    expect(((await unknownKey.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    // A 10-digit barcode is contract-invalid (no EAN-13 form) — refused before auth and before
    // the quota claim, never a downstream normalizer crash.
    const badBarcode = await h.post('/v1/scan', {
      scanId: crypto.randomUUID(),
      kind: 'barcode',
      barcode: '1234567890',
    });
    expect(badBarcode.status).toBe(400);
    expect(((await badBarcode.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('analyze-food: a missing Authorization header is a 401 envelope', async () => {
    const h = harness();
    const res = await h.post('/v1/scan', photoBody(crypto.randomUUID()));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('cascade skeleton: delegates return cache hits and typed misses', async () => {
    const h = harness();
    await h.seedPositive(CACHE_KEY, CACHE_PAYLOAD);
    const { userId } = await h.newUser();
    const cache = dbCacheStore(h.db, userId);
    try {
      const hit = await resolveSearch(cache, '  Chicken-Rice  ');
      expect('per100g' in hit).toBe(true); // a live cache row must ground the search
      if (!('per100g' in hit)) throw new Error('expected a grounded hit');
      expect(hit.source).toBe('cache');
      expect(hit.cacheKey).toBe('search:chicken-rice');
      expect(hit.per100g.kcal).toBe(145);

      const foodHit = await resolveFood(cache, 'chicken-rice');
      expect('per100g' in foodHit).toBe(true);

      // Suite-scoped barcode key: barcode.test.ts owns 3017620422003.
      expect(await resolveBarcode(cache, '3000000000004', missTiers)).toEqual({ kind: 'not_found' });
      expect(await resolveSearch(cache, 'never-cached-item', missTiers)).toEqual({ kind: 'not_found' });
    } finally {
      await h.deleteCacheKey(CACHE_KEY);
      await h.deleteCacheKey('barcode:3000000000004');
      await h.deleteCacheKey('search:never-cached-item');
    }
  });

  it('analyze-food: suite cleanup removes the test user and cache seed', async () => {
    const h = harness();
    await h.cleanupData();
    expect(await h.cacheRow(CACHE_KEY)).toBeUndefined();
  });

  it('analyze-food: the fixture photo scan returns the numbers of the shared golden response', async () => {
    const h = harness();
    // The cache is seeded the way the legacy e2e test seeds it.
    await h.seedPositive(CACHE_KEY, CACHE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const request = goldenRequest as Record<string, unknown>;
    const scanId = request.scanId as string;
    await h.deleteScan(scanId);
    try {
      const res = await h.post('/v1/scan', request, token);
      expect(res.status).toBe(200);
      const body = ScanResponseSchema.parse(await res.json());
      expect(body).toEqual(ScanResponseSchema.parse(goldenResponse));
    } finally {
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(CACHE_KEY);
    }
  });
});
