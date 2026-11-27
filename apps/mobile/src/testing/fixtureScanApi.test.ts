/**
 * Jest twin of FixtureScenarioTests.swift and the scan half of GoldenFixtureTests: the golden files
 * decode strictly, the fixture client replays them by scenario, and unknown keys are rejected.
 */
import { KcalArithmetic } from '@coachcal/core';
import { ScanResponseSchema, ErrorEnvelopeSchema } from '@coachcal/api-contract';

import { buildScanRequest, isScanApiError, type ScanApiError } from '../data/api/scanClient';
import { FixtureScanApi, resolveFixtureScenario, goldenFixture } from './fixtureScanApi';

const photoRequest = () => buildScanRequest({ kind: 'photo', imageBase64: 'aGVsbG8=' });

async function errorOf(promise: Promise<unknown>): Promise<ScanApiError> {
  try {
    await promise;
  } catch (error) {
    expect(isScanApiError(error)).toBe(true);
    return error as ScanApiError;
  }
  throw new Error('Expected the fixture to throw');
}

const mutated = (name: Parameters<typeof goldenFixture>[0], mutate: (object: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(goldenFixture(name)));
  mutate(copy);
  return copy;
};

describe('fixture scan api', () => {
  it('scan response 200 decodes strictly and matches arithmetic parity', async () => {
    const response = await new FixtureScanApi('200').analyzeFood(photoRequest());

    expect(response.scanId).toBe('aa000000-0000-4000-8000-000000000001');
    expect(response.kind).toBe('photo');
    expect(response.mealKcal).toBe(464);
    expect(response.scanConfidence).toBe(0.92);
    expect(response.note).toBeNull();

    const item = response.items[0]!;
    expect(item.label).toBe('chicken-rice');
    expect(item.grams).toBe(320);
    expect(item.gramsBasis).toBe('estimated');
    expect(item.confidence).toBe(0.92);
    expect(item.hiddenFatLikely).toBe(false);
    expect(item.source).toBe('cache');
    expect(item.per100g).toEqual({ kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 });
    expect(item.unresolved).toBe(false);

    expect(item.kcal).toBe(KcalArithmetic.mealKcal(145, 320));
    expect(item.proteinG).toBe(KcalArithmetic.macroGrams(27, 320));
    expect(item.carbsG).toBe(KcalArithmetic.macroGrams(40, 320));
    expect(item.fatG).toBe(KcalArithmetic.macroGrams(4, 320));
    expect(item.fiberG).toBe(KcalArithmetic.macroGrams(2, 320));
  });

  it('unresolved 200 variant decodes strictly', async () => {
    const response = await new FixtureScanApi('200-unresolved').analyzeFood(photoRequest());
    const item = response.items[0]!;

    expect(item.label).toBe('chicken-rice');
    // the held-out backstop variant flips only the unresolved flag
    expect(item.unresolved).toBe(true);
    expect(item.kcal).toBe(KcalArithmetic.mealKcal(145, 320));
    expect(response.mealKcal).toBe(464);
  });

  it('quota 402 decodes entitlement and throws envelope', async () => {
    const envelope = ErrorEnvelopeSchema.parse(goldenFixture('error-402-free-limit'));
    expect(envelope.error.code).toBe('FREE_LIMIT_REACHED');
    expect(envelope.error.details).toBeUndefined();
    expect(envelope.error.entitlement).toEqual({
      tier: 'free',
      scansUsed: 3,
      scanLimit: 3,
      windowResetAt: '2026-09-21T10:00:00Z',
    });

    const error = await errorOf(new FixtureScanApi('402').analyzeFood(photoRequest()));
    expect(error.isQuotaReached).toBe(true);
    expect(error).toMatchObject({
      kind: 'envelope',
      code: 'FREE_LIMIT_REACHED',
      entitlement: envelope.error.entitlement,
    });
  });

  it('not found 404 throws barcode not found envelope', async () => {
    const error = await errorOf(
      new FixtureScanApi('404').analyzeFood(buildScanRequest({ kind: 'barcode', barcode: '0123456789012' })),
    );
    expect(error.isBarcodeNotFound).toBe(true);
    expect(error).toMatchObject({
      kind: 'envelope',
      code: 'BARCODE_NOT_FOUND',
      details: ['no grounding source resolved this barcode'],
    });
  });

  it('schema 422 throws vlm schema error envelope', async () => {
    const error = await errorOf(
      new FixtureScanApi('422').analyzeFood(buildScanRequest({ kind: 'label', imageBase64: 'label-1' })),
    );
    expect(error.isSchemaError).toBe(true);
    expect(error).toMatchObject({ kind: 'envelope', code: 'VLM_SCHEMA_ERROR', details: ['items.0'] });
  });

  it('unknown key mutations are rejected for each golden shape', () => {
    expect(ScanResponseSchema.safeParse(goldenFixture('scan-response-200')).success).toBe(true);
    expect(ScanResponseSchema.safeParse(mutated('scan-response-200', (o) => (o.unknownKey = true))).success).toBe(false);
    expect(ScanResponseSchema.safeParse(mutated('scan-response-200', (o) => delete o.mealKcal)).success).toBe(false);

    for (const name of ['error-402-free-limit', 'error-404-barcode-not-found', 'error-422-vlm-schema'] as const) {
      expect(ErrorEnvelopeSchema.safeParse(goldenFixture(name)).success).toBe(true);
      expect(ErrorEnvelopeSchema.safeParse(mutated(name, (o) => (o.unknownKey = true))).success).toBe(false);
      expect(ErrorEnvelopeSchema.safeParse(mutated(name, (o) => delete o.error)).success).toBe(false);
    }
  });

  it('unknown key mutation inside nested item is rejected', () => {
    const body = mutated('scan-response-200', (o) => {
      o.items[0].mysteryField = 1;
    });
    expect(ScanResponseSchema.safeParse(body).success).toBe(false);
  });

  it('scenario resolves from launch arguments with default 200', () => {
    expect(resolveFixtureScenario([])).toBe('200');
    expect(resolveFixtureScenario(['--ccScanScenario', '200'])).toBe('200');
    expect(resolveFixtureScenario(['--ccScanScenario', '402'])).toBe('402');
    expect(resolveFixtureScenario(['--ccScanScenario', '404'])).toBe('404');
    expect(resolveFixtureScenario(['--ccScanScenario', '422'])).toBe('422');
    expect(resolveFixtureScenario(['--ccScanScenario', 'bogus'])).toBe('200');
    expect(resolveFixtureScenario(['--ccScanScenario'])).toBe('200');
    expect(resolveFixtureScenario(['other', '--ccScanScenario', '422', 'trailing'])).toBe('422');
  });

  it('a fixture client built without a scenario replays the golden 200', async () => {
    const response = await new FixtureScanApi().analyzeFood(photoRequest());
    expect(response.mealKcal).toBe(464);
  });

  it('a corrupted golden file fails like the live client does (invalid response)', async () => {
    const api = new FixtureScanApi('200', {
      read: (name) => mutated(name, (o) => (o.mysteryField = 1)),
    });
    const error = await errorOf(api.analyzeFood(photoRequest()));
    expect(error.kind).toBe('invalidResponse');
  });
});
