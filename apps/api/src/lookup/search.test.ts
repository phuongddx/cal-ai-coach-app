import { ErrorEnvelopeSchema, GroundedFoodSchema } from '@coachcal/api-contract';

import { fdcFetch } from '../grounding/fdc';
import { describeSql } from '../testing/sqlHarness';

// The suite drives the real /v1/foods/search route against the local PG17. The FDC fetch seam
// carries a recording stub so every provider pass is observable and no outbound call ever
// leaves the machine (search grounds from FDC only — OFF has no search tier).
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Installs a recording stub on the FDC fetch seam for the duration of `run`: `body` is what the
// stub answers with (an empty search for a typed miss, a captured-shape hit for grounding), and
// every request URL is logged.
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

function searchBody(query: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { query, ...extra };
}

describeSql('food-search (SQL-backed)', (harness) => {
  it('food-search: a seeded cache row answers with zero provider calls', async () => {
    const h = harness();
    await h.seedPositive(CHEDDAR_KEY, CHEDDAR_PAYLOAD);
    const { token } = await h.newUser();
    const log: SeamLog = { fdc: [] };
    try {
      const res = await withFdcSeam(log, { foods: [] }, () => h.post('/v1/foods/search', searchBody('cheddar'), token));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results.length).toBe(1);
      const grounded = GroundedFoodSchema.parse(body.results[0]);
      expect(grounded.source).toBe('cache');
      expect(grounded.cacheKey).toBe(CHEDDAR_KEY);
      expect(grounded.per100g).toEqual(CHEDDAR_PAYLOAD);
      expect(log.fdc.length).toBe(0); // a cache hit must not reach FDC
    } finally {
      await h.deleteCacheKey(CHEDDAR_KEY);
    }
  });

  it('food-search: an unseeded query grounds from fdc and writes a 7-day-TTL cache row', async () => {
    const h = harness();
    await h.deleteCacheKey(FDC_HIT_KEY);
    const { token } = await h.newUser();
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
      const res = await withFdcSeam(log, fdcHit, () => h.post('/v1/foods/search', searchBody(FDC_HIT_QUERY), token));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results.length).toBe(1);
      const grounded = GroundedFoodSchema.parse(body.results[0]);
      expect(grounded.source).toBe('fdc');
      expect(grounded.cacheKey).toBe(FDC_HIT_KEY);
      expect(grounded.per100g).toEqual(FDC_HIT_PAYLOAD);
      expect(log.fdc.length).toBeGreaterThan(0); // an unseeded query must reach FDC

      const cached = await h.cacheRow(FDC_HIT_KEY);
      expect(cached).toBeDefined(); // the grounding must persist a cache row
      expect(cached?.source).toBe('fdc');
      // search rows must expire within a minute of +7 days
      expect(Math.abs(cached!.expiresAt.getTime() - (Date.now() + 7 * DAY_MS))).toBeLessThan(60 * 1000);
    } finally {
      await h.deleteCacheKey(FDC_HIT_KEY);
    }
  });

  it('food-search: a zero-hit search is a typed 404 FOOD_NOT_FOUND', async () => {
    const h = harness();
    const { token } = await h.newUser();
    const log: SeamLog = { fdc: [] };
    try {
      const res = await withFdcSeam(log, { foods: [] }, () => h.post('/v1/foods/search', searchBody(ZERO_HIT_QUERY), token));
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown> & { error: { code: string } };
      expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe('FOOD_NOT_FOUND');
      expect(body.results).toBeUndefined(); // an empty 200 must never disguise a miss
      expect(log.fdc.length).toBeGreaterThan(0); // the zero-hit must have run the FDC tier
    } finally {
      await h.deleteCacheKey(ZERO_HIT_KEY);
    }
  });

  it('food-search: empty and missing-auth requests are typed refusals', async () => {
    const h = harness();
    const empty = await h.post('/v1/foods/search', searchBody(''));
    expect(empty.status).toBe(400);
    const emptyBody = (await empty.json()) as { error: { code: string; details: string[] } };
    expect(ErrorEnvelopeSchema.safeParse(emptyBody).success).toBe(true);
    expect(emptyBody.error.code).toBe('VALIDATION_ERROR');
    expect(emptyBody.error.details.some((detail) => detail.includes('query'))).toBe(true);

    const blank = await h.post('/v1/foods/search', searchBody('   '));
    expect(blank.status).toBe(400);
    expect(((await blank.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const unknownKey = await h.post('/v1/foods/search', searchBody('cheddar', { kind: 'text' }));
    expect(unknownKey.status).toBe(400);
    expect(((await unknownKey.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const unauthenticated = await h.post('/v1/foods/search', searchBody('cheddar'));
    expect(unauthenticated.status).toBe(401);
    const body = await unauthenticated.json();
    expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
    expect((body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('food-search: lookups never consume scan quota', async () => {
    const h = harness();
    await h.seedPositive(CHEDDAR_KEY, CHEDDAR_PAYLOAD);
    const { userId, token } = await h.newUser();
    const log: SeamLog = { fdc: [] };
    try {
      const hit = await withFdcSeam(log, { foods: [] }, () => h.post('/v1/foods/search', searchBody('cheddar'), token));
      expect(hit.status).toBe(200);
      const miss = await withFdcSeam(log, { foods: [] }, () => h.post('/v1/foods/search', searchBody(ZERO_HIT_QUERY), token));
      expect(miss.status).toBe(404);
      const refused = await h.post('/v1/foods/search', searchBody(''), token);
      expect(refused.status).toBe(400);

      expect(await h.usageCount(userId)).toBe(0); // lookup endpoints must be unmetered (TRU-02)
    } finally {
      await h.deleteCacheKey(CHEDDAR_KEY);
      await h.deleteCacheKey(ZERO_HIT_KEY);
    }
  });

  it('food-search: suite cleanup removes the test user and cache seeds', async () => {
    const h = harness();
    await h.cleanupData();
    for (const key of [CHEDDAR_KEY, FDC_HIT_KEY, ZERO_HIT_KEY]) {
      expect(await h.cacheRow(key)).toBeUndefined();
    }
  });
});
