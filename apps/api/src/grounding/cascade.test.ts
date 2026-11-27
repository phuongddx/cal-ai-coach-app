import { UpstreamError, type GroundedFood, type GroundingResult } from '@coachcal/api-contract';

import butterFixture from '../testing/fixtures/fdc-foundation-butter.json';
import nutellaFixture from '../testing/fixtures/off-product-nutella.json';
import {
  resolveBarcode as cascadeResolveBarcode,
  resolveSearch as cascadeResolveSearch,
  type CacheSource,
  type CacheStore,
  type CascadeTiers,
} from './cascade';
import * as fatsecret from './fatsecret';
import { fdcFetch, mapFdcNutrients, resolveBarcode, resolveSearch, type FdcFood } from './fdc';
import { barcodeCacheKey, searchCacheKey, toEan13, toUpca } from './normalize';
import * as off from './off';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFdcFetch(responder: (url: string) => Response): { urls: string[]; restore(): void } {
  const urls: string[] = [];
  const original = fdcFetch.impl;
  fdcFetch.impl = (url: string) => {
    urls.push(url);
    return Promise.resolve(responder(url));
  };
  return {
    urls,
    restore: () => {
      fdcFetch.impl = original;
    },
  };
}

/** Sets (or deletes, with undefined) env vars and returns the function that restores them. */
function setEnv(values: Record<string, string | undefined>): () => void {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

describe('cascade', () => {
  it('fdc: mapFdcNutrients maps the captured Foundation butter fixture via Atwater 2047', () => {
    const per100g = mapFdcNutrients(butterFixture as FdcFood);
    expect(per100g).not.toBeNull(); // the butter fixture must ground (research Pitfall 1)
    expect(per100g?.kcal).toBe(645);
    expect(per100g?.proteinG).toBe(0.85);
    expect(per100g?.carbsG).toBe(0.06);
    expect(per100g?.fatG).toBe(81.11);
    expect(per100g?.fiberG).toBe(0);
  });

  it('fdc: mapFdcNutrients prefers 1008 SR-Legacy energy over the Atwater ids', () => {
    const per100g = mapFdcNutrients({
      foodNutrients: [
        { nutrientId: 2047, unitName: 'KCAL', value: 999 },
        { nutrientId: 1008, unitName: 'KCAL', value: 250 },
      ],
    });
    expect(per100g?.kcal).toBe(250);
  });

  it('fdc: mapFdcNutrients returns null without a KCAL energy id — never kcal 0', () => {
    expect(
      mapFdcNutrients({ foodNutrients: [{ nutrientId: 1003, unitName: 'G', value: 12 }] }),
    ).toBeNull();
    expect(
      mapFdcNutrients({ foodNutrients: [{ nutrientId: 1008, unitName: 'kJ', value: 2000 }] }),
    ).toBeNull();
    expect(mapFdcNutrients({})).toBeNull();
  });

  it('fdc: barcode normalization applies the GTIN-correct rules', () => {
    expect(toUpca('0123456789012')).toBe('123456789012');
    expect(toUpca('01234567890')).toBe('001234567890');
    // GTIN-14 with indicator 0: the UPC-A body is the inner EAN-13 minus its
    // leading 0, check digit re-derived by the 13-digit rule.
    expect(toUpca('00036000291452')).toBe('036000291452');
    expect(() => toUpca('0123456789')).toThrow();
    expect(() => toUpca('3017620422003')).toThrow();
    expect(() => toUpca('10000000000000')).toThrow();

    expect(toEan13('3017620422003')).toBe('3017620422003');
    expect(toEan13('0123456789012')).toBe('0123456789012');
    expect(toEan13('036000291452')).toBe('0036000291452');
    expect(() => toEan13('abc')).toThrow();

    expect(searchCacheKey('  Chicken   Rice ')).toBe('search:chicken rice');
    expect(barcodeCacheKey('3017620422003')).toBe('barcode:3017620422003');
  });

  it('fdc: resolveBarcode queries both UPC-A and EAN-13 variants and matches gtinUpc', async () => {
    const stub = stubFdcFetch((url) => {
      const query = new URL(url).searchParams.get('query');
      if (query === '123456789012') return jsonResponse({ totalHits: 0, foods: [] });
      return jsonResponse({
        totalHits: 2,
        foods: [
          {
            description: 'wrong product',
            gtinUpc: '999999999999',
            foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 111 }],
          },
          {
            description: 'matched product',
            gtinUpc: '123456789012',
            foodNutrients: [
              { nutrientId: 1008, unitName: 'KCAL', value: 250 },
              { nutrientId: 1003, unitName: 'G', value: 5 },
              { nutrientId: 1004, unitName: 'G', value: 12 },
              { nutrientId: 1005, unitName: 'G', value: 30 },
              { nutrientId: 1079, unitName: 'G', value: 2 },
            ],
          },
        ],
      });
    });
    try {
      const result = await resolveBarcode('0123456789012');
      expect('per100g' in result).toBe(true); // the matched gtinUpc row must ground
      if (!('per100g' in result)) return;
      expect(result.source).toBe('fdc');
      expect(result.cacheKey).toBe('barcode:0123456789012');
      expect(result.per100g.kcal).toBe(250);
      expect(result.per100g.proteinG).toBe(5);

      expect(stub.urls.length).toBe(2); // both barcode variants must be queried
      const queries = stub.urls.map((url) => new URL(url).searchParams.get('query'));
      expect(queries).toEqual(['123456789012', '0123456789012']);
      for (const url of stub.urls) {
        expect(new URL(url).searchParams.get('dataType')).toBe('Branded');
        expect(new URL(url).searchParams.get('api_key')).not.toBeNull();
        expect(url.startsWith('https://api.nal.usda.gov/fdc/v1/foods/search?')).toBe(true);
      }
    } finally {
      stub.restore();
    }
  });

  it('fdc: resolveSearch takes the first parseable food and types the miss', async () => {
    const stub = stubFdcFetch(() =>
      jsonResponse({
        totalHits: 2,
        foods: [
          {
            description: 'energy-less row',
            foodNutrients: [{ nutrientId: 1003, unitName: 'G', value: 1 }],
          },
          butterFixture,
        ],
      }),
    );
    try {
      const result = await resolveSearch('butter');
      expect('per100g' in result).toBe(true);
      if (!('per100g' in result)) return;
      expect(result.source).toBe('fdc');
      expect(result.cacheKey).toBe('search:butter');
      expect(result.per100g.kcal).toBe(645);
      const [url] = stub.urls;
      expect(new URL(url as string).searchParams.get('dataType')).toBe(
        'Foundation,SR Legacy,Branded',
      );
    } finally {
      stub.restore();
    }

    const empty = stubFdcFetch(() => jsonResponse({ totalHits: 0, foods: [] }));
    try {
      expect(await resolveSearch('zz-no-such-food-qx92')).toEqual({ kind: 'not_found' });
    } finally {
      empty.restore();
    }
  });

  it('fdc: provider failure raises the typed UpstreamError', async () => {
    const httpError = stubFdcFetch(() => new Response('service unavailable', { status: 503 }));
    try {
      await expect(resolveSearch('butter')).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      httpError.restore();
    }

    const original = fdcFetch.impl;
    fdcFetch.impl = () => Promise.reject(new Error('network down'));
    try {
      await expect(resolveBarcode('3017620422003')).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      fdcFetch.impl = original;
    }
  });

  it('fdc/off: a 200 non-JSON body is the typed UpstreamError, never a 500', async () => {
    const html = stubFdcFetch(
      () =>
        new Response('<html>gateway error</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    try {
      await expect(resolveSearch('butter')).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      html.restore();
    }

    const originalOff = off.offFetch.impl;
    off.offFetch.impl = () => Promise.resolve(new Response('{"status":1,"pro', { status: 200 }));
    try {
      await expect(off.resolveBarcode('3017620422003')).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      off.offFetch.impl = originalOff;
    }
  });

  it('fdc/off: upstream fetches carry an abort timeout', async () => {
    const seenFdc: { signal?: AbortSignal } = {};
    const originalFdc = fdcFetch.impl;
    fdcFetch.impl = (_url, init) => {
      seenFdc.signal = init?.signal ?? undefined;
      return Promise.resolve(jsonResponse({ totalHits: 0, foods: [] }));
    };
    try {
      await resolveSearch('butter');
    } finally {
      fdcFetch.impl = originalFdc;
    }
    expect(seenFdc.signal).toBeInstanceOf(AbortSignal); // the FDC fetch must receive an abort signal

    const seenOff: { signal?: AbortSignal } = {};
    const originalOff = off.offFetch.impl;
    off.offFetch.impl = (_url, init) => {
      seenOff.signal = init?.signal ?? undefined;
      return Promise.resolve(jsonResponse({ status: 0 }));
    };
    try {
      await off.resolveBarcode('3017620422003');
    } finally {
      off.offFetch.impl = originalOff;
    }
    expect(seenOff.signal).toBeInstanceOf(AbortSignal); // the OFF fetch must receive an abort signal
  });

  it('off: resolves the captured nutella fixture through GroundedFoodSchema', async () => {
    const restoreEnv = setEnv({ OFF_USER_AGENT: 'CoachCal/0.1 (test-agent)' });
    const original = off.offFetch.impl;
    const urls: string[] = [];
    let seenUserAgent: string | null = null;
    off.offFetch.impl = (url, init) => {
      urls.push(url);
      seenUserAgent = new Headers(init?.headers).get('User-Agent');
      return Promise.resolve(jsonResponse(nutellaFixture));
    };
    try {
      const result = await off.resolveBarcode('3017620422003');
      expect('per100g' in result).toBe(true); // the nutella fixture must ground
      if (!('per100g' in result)) return;
      expect(result.source).toBe('off');
      expect(result.cacheKey).toBe('barcode:3017620422003');
      expect(result.per100g.kcal).toBe(539);
      expect(result.per100g.proteinG).toBe(6.3);
      expect(result.per100g.carbsG).toBe(57.5);
      expect(result.per100g.fatG).toBe(30.9);
      expect(result.per100g.fiberG).toBe(3.4);
      expect(urls.length).toBe(1);
      const url = new URL(urls[0] as string);
      expect(url.pathname).toBe('/api/v2/product/3017620422003.json');
      expect(url.searchParams.get('fields')).toBe('code,product_name,nutriments');
      expect(seenUserAgent).toBe('CoachCal/0.1 (test-agent)');
    } finally {
      off.offFetch.impl = original;
      restoreEnv();
    }
  });

  it('off: status-0, missing-product, and missing-energy bodies are typed misses', async () => {
    const original = off.offFetch.impl;
    off.offFetch.impl = (url) => {
      if (url.includes('1000000000001')) return Promise.resolve(jsonResponse({ status: 0 }));
      if (url.includes('2000000000002')) return Promise.resolve(jsonResponse({ status: 1 }));
      return Promise.resolve(
        jsonResponse({ status: 1, product: { nutriments: { proteins_100g: 4 } } }),
      );
    };
    try {
      expect(await off.resolveBarcode('1000000000001')).toEqual({ kind: 'not_found' });
      expect(await off.resolveBarcode('2000000000002')).toEqual({ kind: 'not_found' });
      // missing energy must miss, never kcal 0
      expect(await off.resolveBarcode('3000000000003')).toEqual({ kind: 'not_found' });
    } finally {
      off.offFetch.impl = original;
    }
  });

  it('off/fatsecret: credential-gated stub is a typed miss with zero fetches', async () => {
    const restoreEnv = setEnv({ FATSECRET_CLIENT_ID: undefined, FATSECRET_CLIENT_SECRET: undefined });
    const realFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCalls++;
      return realFetch(...args);
    }) as typeof fetch;
    try {
      expect(await fatsecret.resolveBarcode('3017620422003')).toEqual({ kind: 'not_found' });
      expect(fetchCalls).toBe(0); // the stub must not touch the network
    } finally {
      globalThis.fetch = realFetch;
      restoreEnv();
    }
  });

  it('off/fatsecret: with credentials present the stub fails closed with UpstreamError', async () => {
    const restoreEnv = setEnv({ FATSECRET_CLIENT_ID: 'test-id', FATSECRET_CLIENT_SECRET: 'test-secret' });
    try {
      await expect(fatsecret.resolveBarcode('3017620422003')).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      restoreEnv();
    }
  });
});

interface FakeCacheRow {
  cache_key: string;
  source: string;
  payload: unknown;
  expires_at: string;
}

/** In-memory CacheStore: get honours expiry (like cache_get), put records expires_at. */
function fakeCache(seed: FakeCacheRow[] = []): { cache: CacheStore; writes: FakeCacheRow[] } {
  const rows = new Map(seed.map((row) => [row.cache_key, row]));
  const writes: FakeCacheRow[] = [];
  const cache: CacheStore = {
    get: async (key: string) => {
      const row = rows.get(key);
      return row && new Date(row.expires_at).getTime() > Date.now() ? row.payload : null;
    },
    put: async (key: string, source: CacheSource, payload: unknown, ttlMs: number) => {
      const row = {
        cache_key: key,
        source,
        payload,
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
      };
      writes.push(row);
      rows.set(key, row);
    },
  };
  return { cache, writes };
}

function stubTiers(config: {
  fdcBarcode?: GroundingResult;
  fdcSearch?: GroundingResult;
  off?: GroundingResult;
  fatsecret?: GroundingResult;
  fdcBarcodeThrows?: Error;
}): { tiers: CascadeTiers; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    tiers: {
      fdc: {
        resolveBarcode: async () => {
          calls.push('fdc');
          if (config.fdcBarcodeThrows) throw config.fdcBarcodeThrows;
          return config.fdcBarcode ?? { kind: 'not_found' };
        },
        resolveSearch: async () => {
          calls.push('fdcSearch');
          return config.fdcSearch ?? { kind: 'not_found' };
        },
      },
      off: {
        resolveBarcode: async () => {
          calls.push('off');
          return config.off ?? { kind: 'not_found' };
        },
      },
      fatsecret: {
        resolveBarcode: async () => {
          calls.push('fatsecret');
          return config.fatsecret ?? { kind: 'not_found' };
        },
      },
    },
  };
}

function grounded(source: 'fdc' | 'off' | 'fatsecret', kcal: number): GroundedFood {
  return {
    source,
    cacheKey: 'overwritten-by-cascade',
    per100g: { kcal, proteinG: 1, carbsG: 2, fatG: 3, fiberG: 4 },
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function withinTolerance(actualIso: string | undefined, expectedMs: number): void {
  const actual = new Date(actualIso as string).getTime();
  // expires_at must be within a minute of the expected time
  expect(Math.abs(actual - expectedMs)).toBeLessThan(60_000);
}

describe('cascade (cache-first tiers)', () => {
  it('cascade: barcode precedence is fdc then off then fatsecret', async () => {
    const { cache, writes } = fakeCache();
    const { tiers, calls } = stubTiers({ fatsecret: grounded('fatsecret', 250) });
    const result = await cascadeResolveBarcode(cache, '3017620422003', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.source).toBe('fatsecret');
    expect(result.cacheKey).toBe('barcode:3017620422003');
    expect(calls).toEqual(['fdc', 'off', 'fatsecret']);
    expect(writes.length).toBe(1);
    expect(writes[0]?.source).toBe('fatsecret');
  });

  it('cascade: an fdc hit stops the tier chain', async () => {
    const { cache } = fakeCache();
    const { tiers, calls } = stubTiers({ fdcBarcode: grounded('fdc', 645) });
    const result = await cascadeResolveBarcode(cache, '0123456789012', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.source).toBe('fdc');
    expect(calls).toEqual(['fdc']);
  });

  it('cascade: a positive cache hit short-circuits with zero tier calls', async () => {
    const { cache, writes } = fakeCache([
      {
        cache_key: 'barcode:3017620422003',
        source: 'off',
        payload: { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 },
        expires_at: new Date(Date.now() + HOUR).toISOString(),
      },
    ]);
    const { tiers, calls } = stubTiers({});
    const result = await cascadeResolveBarcode(cache, '3017620422003', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.source).toBe('cache');
    expect(result.per100g.kcal).toBe(539);
    expect(calls).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('cascade: an expired positive row is a miss that re-grounds and rewrites', async () => {
    const { cache, writes } = fakeCache([
      {
        cache_key: 'barcode:3017620422003',
        source: 'fdc',
        payload: { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ]);
    const { tiers, calls } = stubTiers({ fdcBarcode: grounded('fdc', 645) });
    const result = await cascadeResolveBarcode(cache, '3017620422003', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.per100g.kcal).toBe(645);
    expect(calls).toEqual(['fdc']);
    expect(writes.length).toBe(1);
  });

  it('cascade: a negative cache row short-circuits within TTL with zero tier calls', async () => {
    const { cache, writes } = fakeCache([
      {
        cache_key: 'search:ghost food',
        source: 'negative',
        payload: { notFound: true },
        expires_at: new Date(Date.now() + HOUR).toISOString(),
      },
    ]);
    const { tiers, calls } = stubTiers({ fdcSearch: grounded('fdc', 100) });
    const result = await cascadeResolveSearch(cache, 'Ghost Food', tiers);
    expect(result).toEqual({ kind: 'not_found' });
    expect(calls).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('cascade: an upstream provider failure raises UpstreamError and writes nothing', async () => {
    const { cache, writes } = fakeCache();
    const { tiers } = stubTiers({
      fdcBarcodeThrows: new UpstreamError('fdc search returned a non-OK status'),
    });
    await expect(cascadeResolveBarcode(cache, '3017620422003', tiers)).rejects.toBeInstanceOf(
      UpstreamError,
    );
    expect(writes).toEqual([]);
  });

  it('cascade: a positive barcode resolution writes one 30-day per-100g row', async () => {
    const { cache, writes } = fakeCache();
    const { tiers } = stubTiers({ fdcBarcode: grounded('fdc', 645) });
    const before = Date.now();
    const result = await cascadeResolveBarcode(cache, '0123456789012', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.cacheKey).toBe('barcode:0123456789012');
    expect(writes.length).toBe(1);
    expect(writes[0]?.cache_key).toBe('barcode:0123456789012');
    expect(writes[0]?.source).toBe('fdc');
    expect(writes[0]?.payload).toEqual({ kcal: 645, proteinG: 1, carbsG: 2, fatG: 3, fiberG: 4 });
    withinTolerance(writes[0]?.expires_at, before + 30 * DAY);
  });

  it('cascade: an unknown barcode after all tiers writes one 24h negative row', async () => {
    const { cache, writes } = fakeCache();
    const { tiers } = stubTiers({});
    const before = Date.now();
    const result = await cascadeResolveBarcode(cache, '9999999999999', tiers);
    expect(result).toEqual({ kind: 'not_found' });
    expect(writes.length).toBe(1);
    expect(writes[0]?.source).toBe('negative');
    expect(writes[0]?.payload).toEqual({ notFound: true });
    withinTolerance(writes[0]?.expires_at, before + DAY);
  });

  it('cascade: a second lookup of the same unknown barcode performs zero tier calls', async () => {
    const { cache } = fakeCache();
    const first = stubTiers({});
    await cascadeResolveBarcode(cache, '9999999999999', first.tiers);
    expect(first.calls).toEqual(['fdc', 'off', 'fatsecret']);
    const second = stubTiers({ fdcBarcode: grounded('fdc', 5) });
    const result = await cascadeResolveBarcode(cache, '9999999999999', second.tiers);
    expect(result).toEqual({ kind: 'not_found' });
    expect(second.calls).toEqual([]); // the negative row must suppress all provider calls
  });

  it('cascade: search grounds from fdc only and caches for 7 days', async () => {
    const { cache, writes } = fakeCache();
    const { tiers, calls } = stubTiers({ fdcSearch: grounded('fdc', 145) });
    const before = Date.now();
    const result = await cascadeResolveSearch(cache, '  Chicken   Rice ', tiers);
    expect('per100g' in result).toBe(true);
    if (!('per100g' in result)) return;
    expect(result.cacheKey).toBe('search:chicken rice');
    expect(calls).toEqual(['fdcSearch']); // off/fatsecret must never be consulted for search
    expect(writes.length).toBe(1);
    expect(writes[0]?.cache_key).toBe('search:chicken rice');
    withinTolerance(writes[0]?.expires_at, before + 7 * DAY);
  });

  it('cascade: a search miss writes a negative row and the repeat short-circuits', async () => {
    const { cache } = fakeCache();
    const first = stubTiers({});
    expect(await cascadeResolveSearch(cache, 'ghost-food', first.tiers)).toEqual({
      kind: 'not_found',
    });
    const second = stubTiers({ fdcSearch: grounded('fdc', 42) });
    expect(await cascadeResolveSearch(cache, 'ghost-food', second.tiers)).toEqual({
      kind: 'not_found',
    });
    expect(second.calls).toEqual([]);
  });
});
