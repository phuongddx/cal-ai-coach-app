/**
 * Jest twin of LiveApiClientTests.swift (the five @Test cases keep their sentence) plus the cases
 * the new wire needs: the request keys, the tier-2 threshold, I10 (a 200 with an unknown key is
 * rejected) and the I6 precondition (per-item per100g and grams reach the caller untouched).
 */
import { createMockFetch } from '../../testing/mockFetch';
import { LiveScanApi, buildScanRequest, isScanApiError, type ScanApiError, type ScanTelemetryEvent } from './scanClient';

const SCAN_ID = '826fa3c6-d8a7-4405-b28b-9dbcd75bc4c5';

const scanItem = {
  label: 'grilled chicken',
  grams: 200,
  gramsBasis: 'estimated',
  confidence: 0.85,
  hiddenFatLikely: false,
  source: 'fdc',
  per100g: { kcal: 124, proteinG: 22.0, carbsG: 0.0, fatG: 3.0, fiberG: 0.0 },
  kcal: 248,
  proteinG: 44.0,
  carbsG: 0.0,
  fatG: 6.0,
  fiberG: 0.0,
  unresolved: false,
};

const okBody = (kind: string = 'photo') => ({
  scanId: SCAN_ID,
  kind,
  items: [scanItem],
  mealKcal: 248,
  scanConfidence: 0.92,
  note: null,
});

const photoRequest = () => buildScanRequest({ kind: 'photo', imageBase64: 'aGVsbG8=', scanId: SCAN_ID });

async function errorOf(promise: Promise<unknown>): Promise<ScanApiError> {
  try {
    await promise;
  } catch (error) {
    expect(isScanApiError(error)).toBe(true);
    return error as ScanApiError;
  }
  throw new Error('expected a ScanApiError');
}

const auth = { token: async () => 'access-token' };
const baseUrl = 'http://api.test';

describe('LiveScanApi', () => {
  it('decodes the same scan response fixture api client decodes', async () => {
    const fetchImpl = createMockFetch({ json: okBody() });
    const client = new LiveScanApi({ auth, baseUrl, fetchImpl });

    const response = await client.analyzeFood(photoRequest());

    expect(response.scanId).toBe(SCAN_ID);
    expect(response.mealKcal).toBe(248);
    expect(response.items[0]?.label).toBe('grilled chicken');
    expect(fetchImpl.calls[0]?.path).toBe('/v1/scan');
    expect(fetchImpl.calls[0]?.method).toBe('POST');
    expect(fetchImpl.calls[0]?.headers['authorization']).toBe('Bearer access-token');
  });

  it('free limit reached envelope maps to quota scan api error', async () => {
    const fetchImpl = createMockFetch({
      status: 402,
      json: {
        error: {
          code: 'FREE_LIMIT_REACHED',
          entitlement: { tier: 'free', scansUsed: 3, scanLimit: 3, windowResetAt: '2026-09-23T00:00:00Z' },
        },
      },
    });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest()));

    expect(error.isQuotaReached).toBe(true);
    expect(error).toMatchObject({ kind: 'envelope', code: 'FREE_LIMIT_REACHED' });
    expect(error.kind === 'envelope' && error.entitlement?.scansUsed).toBe(3);
  });

  it('barcode not found envelope maps to typed scan api error', async () => {
    const fetchImpl = createMockFetch({
      status: 404,
      json: { error: { code: 'BARCODE_NOT_FOUND', details: ['no grounding source resolved this barcode'] } },
    });
    const request = buildScanRequest({ kind: 'barcode', barcode: '0036000291459' });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(request));

    expect(error.isBarcodeNotFound).toBe(true);
    expect(error.isQuotaReached).toBe(false);
  });

  it('vlm schema error envelope maps to typed scan api error', async () => {
    const fetchImpl = createMockFetch({
      status: 422,
      json: { error: { code: 'VLM_SCHEMA_ERROR', details: ['items.0.confidence: Required'] } },
    });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest()));

    expect(error.isSchemaError).toBe(true);
  });

  it('fast response reports tier 1 telemetry without escalation', async () => {
    const events: ScanTelemetryEvent[] = [];
    let now = 1_000;
    const fetchImpl = createMockFetch(() => {
      now += 800;
      return { json: okBody('text') };
    });
    const client = new LiveScanApi({ auth, baseUrl, fetchImpl, now: () => now, onTelemetry: (event) => events.push(event) });

    await client.analyzeFood(buildScanRequest({ kind: 'text', text: 'chicken and rice' }));

    expect(events).toEqual([{ tier: 'tier1', durationMs: 800, escalated: false }]);
  });

  it('slow response over five seconds reports tier 2 telemetry as escalated', async () => {
    const events: ScanTelemetryEvent[] = [];
    let now = 0;
    const fetchImpl = createMockFetch(() => {
      now += 5_001;
      return { json: okBody() };
    });
    const client = new LiveScanApi({ auth, baseUrl, fetchImpl, now: () => now, onTelemetry: (event) => events.push(event) });

    await client.analyzeFood(photoRequest());

    expect(events).toEqual([{ tier: 'tier2', durationMs: 5_001, escalated: true }]);
  });

  it('sends the wire keys text description and image base64', async () => {
    const fetchImpl = createMockFetch({ json: okBody('text') });
    await new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(
      buildScanRequest({ kind: 'text', text: 'chicken and rice', scanId: SCAN_ID, mealType: 'lunch' }),
    );
    expect(fetchImpl.calls[0]?.body).toEqual({
      scanId: SCAN_ID,
      kind: 'text',
      mealType: 'lunch',
      textDescription: 'chicken and rice',
    });

    const photoFetch = createMockFetch({ json: okBody() });
    await new LiveScanApi({ auth, baseUrl, fetchImpl: photoFetch }).analyzeFood(photoRequest());
    expect(photoFetch.calls[0]?.body).toEqual({ scanId: SCAN_ID, kind: 'photo', imageBase64: 'aGVsbG8=' });
  });

  it('builds a fresh uuid v4 scan id for every request', () => {
    const first = buildScanRequest({ kind: 'barcode', barcode: '0036000291459' });
    const second = buildScanRequest({ kind: 'barcode', barcode: '0036000291459' });
    expect(first.scanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.scanId).not.toBe(second.scanId);
  });

  it('rejects a request whose payload does not match its kind before any network call', async () => {
    const fetchImpl = createMockFetch({ json: okBody() });
    const error = await errorOf(
      new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(buildScanRequest({ kind: 'photo', scanId: SCAN_ID })),
    );
    expect(error.kind).toBe('invalidRequest');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('rejects a 200 scan response that carries an unknown key (invariant I10)', async () => {
    const fetchImpl = createMockFetch({ json: { ...okBody(), mysteryField: true } });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest()));
    expect(error.kind).toBe('invalidResponse');
  });

  it('rejects a 200 scan response whose item carries an unknown key', async () => {
    const body = okBody();
    const fetchImpl = createMockFetch({ json: { ...body, items: [{ ...scanItem, mysteryField: 1 }] } });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest()));
    expect(error.kind).toBe('invalidResponse');
  });

  it('returns per-item per100g and grams untouched so the review sheet can recompute kcal (invariant I6)', async () => {
    const fetchImpl = createMockFetch({ json: okBody() });
    const response = await new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest());
    const item = response.items[0];
    expect(item?.per100g).toEqual(scanItem.per100g);
    expect(item?.grams).toBe(200);
    // the client hands over the server's value; it never rewrites kcal from the grams
    expect(item?.kcal).toBe(248);
  });

  it('maps a dropped connection to a network scan api error', async () => {
    const fetchImpl = createMockFetch({ networkError: 'Network request failed' });
    const error = await errorOf(new LiveScanApi({ auth, baseUrl, fetchImpl }).analyzeFood(photoRequest()));
    expect(error.kind).toBe('network');
  });
});
