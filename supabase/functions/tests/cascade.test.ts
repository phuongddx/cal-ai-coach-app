import { assert, assertRejects, assertEquals, assertThrows } from 'jsr:@std/assert';
import { UpstreamError } from '../_shared/contracts/food.ts';
import {
  fdcFetch,
  mapFdcNutrients,
  resolveBarcode,
  resolveSearch,
  type FdcFood,
} from '../_shared/grounding/fdc.ts';
import {
  barcodeCacheKey,
  searchCacheKey,
  toEan13,
  toUpca,
} from '../_shared/grounding/normalize.ts';
import butterFixture from './fixtures/fdc-foundation-butter.json' with { type: 'json' };
import nutellaFixture from './fixtures/off-product-nutella.json' with { type: 'json' };
import * as off from '../_shared/grounding/off.ts';
import * as fatsecret from '../_shared/grounding/fatsecret.ts';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFdcFetch(
  responder: (url: string) => Response,
): { urls: string[]; restore(): void } {
  const urls: string[] = [];
  const original = fdcFetch.impl;
  fdcFetch.impl = (url: string) => {
    urls.push(url);
    return Promise.resolve(responder(url));
  };
  return { urls, restore: () => { fdcFetch.impl = original; } };
}

Deno.test('fdc: mapFdcNutrients maps the captured Foundation butter fixture via Atwater 2047', () => {
  const per100g = mapFdcNutrients(butterFixture as FdcFood);
  assert(per100g !== null, 'the butter fixture must ground (research Pitfall 1)');
  assertEquals(per100g.kcal, 645);
  assertEquals(per100g.proteinG, 0.85);
  assertEquals(per100g.carbsG, 0.06);
  assertEquals(per100g.fatG, 81.11);
  assertEquals(per100g.fiberG, 0);
});

Deno.test('fdc: mapFdcNutrients prefers 1008 SR-Legacy energy over the Atwater ids', () => {
  const per100g = mapFdcNutrients({
    foodNutrients: [
      { nutrientId: 2047, unitName: 'KCAL', value: 999 },
      { nutrientId: 1008, unitName: 'KCAL', value: 250 },
    ],
  });
  assertEquals(per100g?.kcal, 250);
});

Deno.test('fdc: mapFdcNutrients returns null without a KCAL energy id — never kcal 0', () => {
  assertEquals(mapFdcNutrients({ foodNutrients: [{ nutrientId: 1003, unitName: 'G', value: 12 }] }), null);
  assertEquals(
    mapFdcNutrients({ foodNutrients: [{ nutrientId: 1008, unitName: 'kJ', value: 2000 }] }),
    null,
  );
  assertEquals(mapFdcNutrients({}), null);
});

Deno.test('fdc: barcode normalization applies the GTIN-correct rules', () => {
  assertEquals(toUpca('0123456789012'), '123456789012');
  assertEquals(toUpca('01234567890'), '001234567890');
  assertThrows(() => toUpca('0123456789'));
  assertThrows(() => toUpca('3017620422003'));

  assertEquals(toEan13('3017620422003'), '3017620422003');
  assertEquals(toEan13('0123456789012'), '0123456789012');
  assertEquals(toEan13('036000291452'), '0036000291452');
  assertThrows(() => toEan13('abc'));

  assertEquals(searchCacheKey('  Chicken   Rice '), 'search:chicken rice');
  assertEquals(barcodeCacheKey('3017620422003'), 'barcode:3017620422003');
});

Deno.test('fdc: resolveBarcode queries both UPC-A and EAN-13 variants and matches gtinUpc', async () => {
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
    assert('per100g' in result, 'the matched gtinUpc row must ground');
    assertEquals(result.source, 'fdc');
    assertEquals(result.cacheKey, 'barcode:0123456789012');
    assertEquals(result.per100g.kcal, 250);
    assertEquals(result.per100g.proteinG, 5);

    assertEquals(stub.urls.length, 2, 'both barcode variants must be queried');
    const queries = stub.urls.map((url) => new URL(url).searchParams.get('query'));
    assertEquals(queries, ['123456789012', '0123456789012']);
    for (const url of stub.urls) {
      assertEquals(new URL(url).searchParams.get('dataType'), 'Branded');
      assert(new URL(url).searchParams.get('api_key') !== null);
      assert(url.startsWith('https://api.nal.usda.gov/fdc/v1/foods/search?'));
    }
  } finally {
    stub.restore();
  }
});

Deno.test('fdc: resolveSearch takes the first parseable food and types the miss', async () => {
  const stub = stubFdcFetch(() =>
    jsonResponse({
      totalHits: 2,
      foods: [
        { description: 'energy-less row', foodNutrients: [{ nutrientId: 1003, unitName: 'G', value: 1 }] },
        butterFixture,
      ],
    })
  );
  try {
    const result = await resolveSearch('butter');
    assert('per100g' in result);
    assertEquals(result.source, 'fdc');
    assertEquals(result.cacheKey, 'search:butter');
    assertEquals(result.per100g.kcal, 645);
    const [url] = stub.urls;
    assertEquals(new URL(url).searchParams.get('dataType'), 'Foundation,SR Legacy,Branded');
  } finally {
    stub.restore();
  }

  const empty = stubFdcFetch(() => jsonResponse({ totalHits: 0, foods: [] }));
  try {
    assertEquals(await resolveSearch('zz-no-such-food-qx92'), { kind: 'not_found' });
  } finally {
    empty.restore();
  }
});

Deno.test('fdc: provider failure raises the typed UpstreamError', async () => {
  const httpError = stubFdcFetch(() => new Response('service unavailable', { status: 503 }));
  try {
    await assertRejects(
      () => resolveSearch('butter'),
      UpstreamError,
    );
  } finally {
    httpError.restore();
  }

  const original = fdcFetch.impl;
  fdcFetch.impl = () => Promise.reject(new Error('network down'));
  try {
    await assertRejects(() => resolveBarcode('3017620422003'), UpstreamError);
  } finally {
    fdcFetch.impl = original;
  }
});

Deno.test('off: resolves the captured nutella fixture through GroundedFoodSchema', async () => {
  const savedUserAgent = Deno.env.get('OFF_USER_AGENT');
  Deno.env.set('OFF_USER_AGENT', 'CoachCal/0.1 (test-agent)');
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
    assert('per100g' in result, 'the nutella fixture must ground');
    assertEquals(result.source, 'off');
    assertEquals(result.cacheKey, 'barcode:3017620422003');
    assertEquals(result.per100g.kcal, 539);
    assertEquals(result.per100g.proteinG, 6.3);
    assertEquals(result.per100g.carbsG, 57.5);
    assertEquals(result.per100g.fatG, 30.9);
    assertEquals(result.per100g.fiberG, 3.4);
    assertEquals(urls.length, 1);
    const url = new URL(urls[0]);
    assertEquals(url.pathname, '/api/v2/product/3017620422003.json');
    assertEquals(url.searchParams.get('fields'), 'code,product_name,nutriments');
    assertEquals(seenUserAgent, 'CoachCal/0.1 (test-agent)');
  } finally {
    off.offFetch.impl = original;
    if (savedUserAgent === undefined) Deno.env.delete('OFF_USER_AGENT');
    else Deno.env.set('OFF_USER_AGENT', savedUserAgent);
  }
});

Deno.test('off: status-0, missing-product, and missing-energy bodies are typed misses', async () => {
  const original = off.offFetch.impl;
  off.offFetch.impl = (url) => {
    if (url.includes('status-zero')) return Promise.resolve(jsonResponse({ status: 0 }));
    if (url.includes('no-product')) return Promise.resolve(jsonResponse({ status: 1 }));
    return Promise.resolve(jsonResponse({
      status: 1,
      product: { nutriments: { 'proteins_100g': 4 } },
    }));
  };
  try {
    assertEquals(await off.resolveBarcode('1000000000001'), { kind: 'not_found' });
    assertEquals(await off.resolveBarcode('2000000000002'), { kind: 'not_found' });
    assertEquals(
      await off.resolveBarcode('3000000000003'),
      { kind: 'not_found' },
      'missing energy must miss, never kcal 0',
    );
  } finally {
    off.offFetch.impl = original;
  }
});

Deno.test('off/fatsecret: credential-gated stub is a typed miss with zero fetches', async () => {
  const savedId = Deno.env.get('FATSECRET_CLIENT_ID');
  const savedSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  Deno.env.delete('FATSECRET_CLIENT_ID');
  Deno.env.delete('FATSECRET_CLIENT_SECRET');
  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    fetchCalls++;
    return realFetch(...args);
  }) as typeof fetch;
  try {
    assertEquals(await fatsecret.resolveBarcode('3017620422003'), { kind: 'not_found' });
    assertEquals(fetchCalls, 0, 'the stub must not touch the network');
  } finally {
    globalThis.fetch = realFetch;
    if (savedId !== undefined) Deno.env.set('FATSECRET_CLIENT_ID', savedId);
    if (savedSecret !== undefined) Deno.env.set('FATSECRET_CLIENT_SECRET', savedSecret);
  }
});

Deno.test('off/fatsecret: with credentials present the stub fails closed with UpstreamError', async () => {
  const savedId = Deno.env.get('FATSECRET_CLIENT_ID');
  const savedSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  Deno.env.set('FATSECRET_CLIENT_ID', 'test-id');
  Deno.env.set('FATSECRET_CLIENT_SECRET', 'test-secret');
  try {
    await assertRejects(() => fatsecret.resolveBarcode('3017620422003'), UpstreamError);
  } finally {
    if (savedId === undefined) Deno.env.delete('FATSECRET_CLIENT_ID');
    else Deno.env.set('FATSECRET_CLIENT_ID', savedId);
    if (savedSecret === undefined) Deno.env.delete('FATSECRET_CLIENT_SECRET');
    else Deno.env.set('FATSECRET_CLIENT_SECRET', savedSecret);
  }
});
