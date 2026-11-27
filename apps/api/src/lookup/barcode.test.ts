import { ErrorEnvelopeSchema, GroundedFoodSchema } from '@coachcal/api-contract';

import { fdcFetch } from '../grounding/fdc';
import { offFetch } from '../grounding/off';
import { describeSql } from '../testing/sqlHarness';

// The suite drives the real /v1/barcode/resolve route against the local PG17 with a dev-token
// user. Provider fetch seams carry recording all-miss stubs so every provider pass is
// observable and no outbound call ever leaves the machine.
const BARCODE = '3017620422003';
const BARCODE_KEY = `barcode:${BARCODE}`;
const BARCODE_PAYLOAD = { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 };
const UNKNOWN_BARCODE = '9999999999999';
const UNKNOWN_BARCODE_KEY = `barcode:${UNKNOWN_BARCODE}`;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SeamLog {
  fdc: string[];
  off: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Installs recording all-miss stubs on both fetch seams for the duration of `run`:
// FDC answers an empty Branded search, OFF a status-0 body — an unexpected provider
// pass yields a typed miss, never a live network call.
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

function lookupBody(barcode: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { barcode, ...extra };
}

describeSql('barcode-resolve (SQL-backed)', (harness) => {
  it('barcode-resolve: a seeded-cache barcode answers from cache with zero provider calls', async () => {
    const h = harness();
    await h.seedPositive(BARCODE_KEY, BARCODE_PAYLOAD);
    const { token } = await h.newUser();
    const log: SeamLog = { fdc: [], off: [] };
    try {
      const res = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(BARCODE), token));
      expect(res.status).toBe(200);
      const body = GroundedFoodSchema.parse(await res.json());
      expect(body.source).toBe('cache');
      expect(body.cacheKey).toBe(BARCODE_KEY);
      expect(body.per100g).toEqual(BARCODE_PAYLOAD);
      expect(log.fdc.length).toBe(0); // a cache hit must not reach FDC
      expect(log.off.length).toBe(0); // a cache hit must not reach OFF
    } finally {
      await h.deleteCacheKey(BARCODE_KEY);
    }
  });

  it('barcode-resolve: an unknown barcode with all-miss tiers is a typed 404, never a guess', async () => {
    const h = harness();
    await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
    const { token } = await h.newUser();
    const log: SeamLog = { fdc: [], off: [] };
    try {
      const res = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(UNKNOWN_BARCODE), token));
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown> & { error: { code: string } };
      expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe('BARCODE_NOT_FOUND');
      expect(body.per100g).toBeUndefined(); // no fabricated nutrition fields
      expect(body.source).toBeUndefined(); // no fabricated source attribution
      expect(log.fdc.length).toBeGreaterThan(0); // the miss must have run the provider tiers
      expect(log.off.length).toBeGreaterThan(0); // the miss must have run the OFF tier
    } finally {
      await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
    }
  });

  it('barcode-resolve: malformed request shapes are 400 VALIDATION_ERROR', async () => {
    const h = harness();
    const nonDigit = await h.post('/v1/barcode/resolve', lookupBody('12abc34'));
    expect(nonDigit.status).toBe(400);
    const nonDigitBody = (await nonDigit.json()) as { error: { code: string; details: string[] } };
    expect(ErrorEnvelopeSchema.safeParse(nonDigitBody).success).toBe(true);
    expect(nonDigitBody.error.code).toBe('VALIDATION_ERROR');
    expect(nonDigitBody.error.details.some((detail) => detail.includes('barcode'))).toBe(true);

    // 10 digits is contract-invalid: the normalizer has no EAN-13 form for it,
    // so it must be refused at the boundary, never reach the cascade.
    const wrongLength = await h.post('/v1/barcode/resolve', lookupBody('1234567890'));
    expect(wrongLength.status).toBe(400);
    expect(((await wrongLength.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const unknownKey = await h.post('/v1/barcode/resolve', lookupBody('123456789', { kind: 'barcode' }));
    expect(unknownKey.status).toBe(400);
    expect(((await unknownKey.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const notJson = await h.post('/v1/barcode/resolve', 'not json');
    expect(notJson.status).toBe(400);
    expect(((await notJson.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('barcode-resolve: a missing Authorization header is a 401 envelope', async () => {
    const h = harness();
    const res = await h.post('/v1/barcode/resolve', lookupBody(BARCODE));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
    expect((body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('barcode-resolve: lookups never consume scan quota', async () => {
    const h = harness();
    await h.seedPositive(BARCODE_KEY, BARCODE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const log: SeamLog = { fdc: [], off: [] };
    try {
      const hit = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(BARCODE), token));
      expect(hit.status).toBe(200);
      const miss = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(UNKNOWN_BARCODE), token));
      expect(miss.status).toBe(404);
      const refused = await h.post('/v1/barcode/resolve', lookupBody('12abc34'), token);
      expect(refused.status).toBe(400);

      expect(await h.usageCount(userId)).toBe(0); // lookup endpoints must be unmetered (TRU-02)
    } finally {
      await h.deleteCacheKey(BARCODE_KEY);
      await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
    }
  });

  it('barcode-resolve: a miss caches negatively for 24h and the second lookup performs zero provider fetches', async () => {
    const h = harness();
    await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
    const { token } = await h.newUser();
    const log: SeamLog = { fdc: [], off: [] };
    try {
      const first = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(UNKNOWN_BARCODE), token));
      expect(first.status).toBe(404);
      const firstPassFetches = log.fdc.length + log.off.length;
      expect(firstPassFetches).toBeGreaterThan(0); // the first miss must reach the providers

      const second = await withMissSeams(log, () => h.post('/v1/barcode/resolve', lookupBody(UNKNOWN_BARCODE), token));
      expect(second.status).toBe(404);

      // the second lookup must be served by the 24h negative row, zero fetches
      expect(log.fdc.length + log.off.length).toBe(firstPassFetches);
      const negative = await h.cacheRow(UNKNOWN_BARCODE_KEY);
      expect(negative?.source).toBe('negative');
      // negative rows must expire within a minute of +24h
      expect(Math.abs(negative!.expiresAt.getTime() - (Date.now() + DAY_MS))).toBeLessThan(60 * 1000);
    } finally {
      await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
    }
  });

  it('barcode-resolve: suite cleanup removes the test user and cache seeds', async () => {
    const h = harness();
    await h.cleanupData();
    expect(await h.cacheRow(BARCODE_KEY)).toBeUndefined();
    expect(await h.cacheRow(UNKNOWN_BARCODE_KEY)).toBeUndefined();
  });
});
