import { ScanResponseSchema, type VlmOutput } from '@coachcal/api-contract';

import { chooseTier, TIER1_MIN_ITEM_CONFIDENCE, TIER1_MIN_SCAN_CONFIDENCE } from './routing';
import { describeSql, setEnv } from './testing/sqlHarness';
import { FixtureProvider } from './vlm/fixture';
import {
  overrideVlmProvider,
  type VlmInput,
  type VlmProvider,
  type VlmTier,
} from './vlm/provider';

const PROTEIN_BAR_KEY = 'search:protein bar';
const ALMONDS_KEY = 'search:roasted almonds';
const CHICKEN_RICE_KEY = 'search:chicken-rice';
// Suite-scoped barcode key: scan-gates.test.ts owns 0036000291452.
const BARCODE_KEY = 'barcode:0036000291459';
const TEXT_KEYS = [
  'search:grilled chicken',
  'search:greek salad',
  'search:banana',
  'search:greek yogurt',
];

function scanBody(
  scanId: string,
  kind: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return { scanId, kind, mealType: 'lunch', ...payload };
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

describe('modes (routing)', () => {
  it('routing: chooseTier escalates below the tier1 confidence floors', () => {
    expect(TIER1_MIN_SCAN_CONFIDENCE).toBe(0.7);
    expect(TIER1_MIN_ITEM_CONFIDENCE).toBe(0.5);

    const atThresholds: VlmOutput = {
      isFood: true,
      items: [{ label: 'x', grams: 100, gramsBasis: 'estimated', confidence: 0.5, hiddenFatLikely: false }],
      scanConfidence: 0.7,
      note: null,
    };
    expect(chooseTier(atThresholds)).toBe('tier1'); // thresholds are inclusive floors

    const lowScan: VlmOutput = { ...atThresholds, scanConfidence: 0.69 };
    expect(chooseTier(lowScan)).toBe('tier2');

    const lowItem: VlmOutput = {
      isFood: true,
      items: [{ label: 'x', grams: 100, gramsBasis: 'estimated', confidence: 0.49, hiddenFatLikely: false }],
      scanConfidence: 0.95,
      note: null,
    };
    expect(chooseTier(lowItem)).toBe('tier2');
  });
});

describeSql('modes (scan route, SQL-backed)', (harness) => {
  it('label scan grounds per-serving packaged values through the arithmetic path', async () => {
    const h = harness();
    await h.seedPositive(PROTEIN_BAR_KEY, { kcal: 400, proteinG: 30, carbsG: 40, fatG: 15, fiberG: 8 });
    await h.seedNegative(ALMONDS_KEY);
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    try {
      const res = await h.post(
        '/v1/scan',
        scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }),
        token,
      );
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());
      expect(parsed.kind).toBe('label');
      expect(parsed.items.length).toBe(2);

      const bar = parsed.items[0]!;
      expect(bar.label).toBe('protein bar');
      expect(bar.gramsBasis).toBe('packaged-serving');
      expect(bar.kcal).toBe(Math.round((400 * 60) / 100));
      expect(bar.kcal).toBe(240);
      expect(bar.source).toBe('cache');
      expect(bar.unresolved).toBe(false);

      const almonds = parsed.items[1]!;
      expect(almonds.label).toBe('roasted almonds');
      expect(almonds.unresolved).toBe(true);
      expect(almonds.kcal).toBe(0);
      expect(almonds.source).toBe('none');
      expect(parsed.mealKcal).toBe(240);
    } finally {
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(PROTEIN_BAR_KEY);
      await h.deleteCacheKey(ALMONDS_KEY);
    }
  });

  it('label scan with every item unresolved is a typed 404, never a guess', async () => {
    const h = harness();
    await h.seedNegative(PROTEIN_BAR_KEY);
    await h.seedNegative(ALMONDS_KEY);
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    try {
      const res = await h.post(
        '/v1/scan',
        scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }),
        token,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('FOOD_NOT_FOUND');
      expect(await h.scanCount(scanId)).toBe(0); // a 404 must not persist a scan
    } finally {
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(PROTEIN_BAR_KEY);
      await h.deleteCacheKey(ALMONDS_KEY);
    }
  });

  it('text scan is deterministic byte-for-byte across identical descriptions', async () => {
    const h = harness();
    await h.seedPositive('search:grilled chicken', { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 });
    await h.seedPositive('search:greek salad', { kcal: 90, proteinG: 3, carbsG: 6, fatG: 6, fiberG: 2 });
    await h.seedPositive('search:banana', { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 });
    await h.seedPositive('search:greek yogurt', { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, fiberG: 0 });
    const { userId, token } = await h.newUser({ entitled: true });
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    const description = 'hearty grilled chicken bowl with greens';
    try {
      const first = await h.post(
        '/v1/scan',
        scanBody(firstId, 'text', { textDescription: description }),
        token,
      );
      expect(first.status).toBe(200);
      const second = await h.post(
        '/v1/scan',
        scanBody(secondId, 'text', { textDescription: description }),
        token,
      );
      expect(second.status).toBe(200);
      const firstParsed = ScanResponseSchema.parse(await first.json());
      const secondParsed = ScanResponseSchema.parse(await second.json());

      // identical text must yield byte-identical item lists
      expect(JSON.stringify(firstParsed.items)).toBe(JSON.stringify(secondParsed.items));
      expect(firstParsed.items.length).toBeGreaterThan(0);
      expect(firstParsed.items[0]?.unresolved).toBe(false);
      const item = firstParsed.items[0]!;
      expect(item.kcal).toBe(Math.round((item.per100g.kcal * item.grams) / 100));
    } finally {
      await h.deleteScan(firstId, userId);
      await h.deleteScan(secondId, userId);
      for (const key of TEXT_KEYS) await h.deleteCacheKey(key);
    }
  });

  it('escalate sentinel re-runs exactly once at tier2 and tier2 wins', async () => {
    const h = harness();
    await h.seedPositive(CHICKEN_RICE_KEY, { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 });
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    const counted = countingProvider();
    overrideVlmProvider(counted.provider);
    try {
      const res = await h.post(
        '/v1/scan',
        scanBody(scanId, 'photo', { imageBase64: 'fixture:escalate' }),
        token,
      );
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());
      expect(counted.calls()).toBe(2); // escalation is exactly two provider calls
      expect(counted.tiers()).toEqual(['tier1', 'tier2']);
      expect(parsed.scanConfidence).toBe(0.95); // the tier2 output is authoritative
      expect(parsed.note).toBe('tier2 escalation');
      expect(parsed.items[0]?.kcal).toBe(464);
    } finally {
      overrideVlmProvider(null);
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(CHICKEN_RICE_KEY);
    }
  });

  it('barcode scan performs zero VLM calls and grounds exact cache data', async () => {
    const h = harness();
    await h.seedPositive(BARCODE_KEY, { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 });
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    const counted = countingProvider();
    overrideVlmProvider(counted.provider);
    try {
      const res = await h.post(
        '/v1/scan',
        scanBody(scanId, 'barcode', { barcode: '0036000291459' }),
        token,
      );
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());
      expect(counted.calls()).toBe(0); // the barcode path must bypass the VLM entirely
      expect(parsed.items.length).toBe(1);
      expect(parsed.items[0]?.source).toBe('cache');
      expect(parsed.items[0]?.kcal).toBe(539);
      expect(parsed.items[0]?.unresolved).toBe(false);
      expect(parsed.scanConfidence).toBe(1); // exact DB data carries full confidence, no VLM estimate
    } finally {
      overrideVlmProvider(null);
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(BARCODE_KEY);
    }
  });

  it('malformed fixture mode over the label path is a typed 422, never a 500', async () => {
    const h = harness();
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    const restoreEnv = setEnv({ VLM_FIXTURE_MODE: 'malformed' });
    try {
      const res = await h.post(
        '/v1/scan',
        scanBody(scanId, 'label', { imageBase64: 'fixture:nutrition-label' }),
        token,
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string; details: string[] } };
      expect(body.error.code).toBe('VLM_SCHEMA_ERROR');
      // issue paths must name the offending item
      expect(body.error.details).toContain('items.0');
      expect(await h.scanCount(scanId)).toBe(0); // nothing may persist past a 422
    } finally {
      restoreEnv();
      await h.deleteScan(scanId, userId);
    }
  });

  it('modes suite cleanup removes the test user, entitlement, and cache seeds', async () => {
    const h = harness();
    await h.cleanupData();
    for (const key of [PROTEIN_BAR_KEY, ALMONDS_KEY, CHICKEN_RICE_KEY, BARCODE_KEY, ...TEXT_KEYS]) {
      expect(await h.cacheRow(key)).toBeUndefined();
    }
  });
});
