import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ErrorEnvelopeSchema,
  LookupBarcodeRequestSchema,
  ScanRequestSchema,
  ScanResponseSchema,
  VlmItemSchema,
  VlmOutputSchema,
  RcWebhookEnvelopeSchema,
  eventTypePolicy,
  toWebhookEvent,
} from './index';

const GOLDEN_DIR = join(__dirname, '..', 'golden');
const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(GOLDEN_DIR, name), 'utf8'));

describe('golden fixtures parse with the relocated contracts', () => {
  it('ships every legacy golden file', () => {
    expect(readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.golden.json')).sort()).toEqual([
      'error-402-free-limit.golden.json',
      'error-404-barcode-not-found.golden.json',
      'error-422-vlm-schema.golden.json',
      'scan-request-barcode.golden.json',
      'scan-request-label.golden.json',
      'scan-request-photo.golden.json',
      'scan-request-text.golden.json',
      'scan-response-200.golden.json',
      'webhook-grant-event.golden.json',
      'webhook-response-200.golden.json',
    ]);
  });

  it.each(['barcode', 'label', 'photo', 'text'])('parses the %s scan request', (kind) => {
    const parsed = ScanRequestSchema.parse(golden(`scan-request-${kind}.golden.json`));
    expect(parsed.kind).toBe(kind);
  });

  it('parses the scan response and its totals match the item arithmetic', () => {
    const parsed = ScanResponseSchema.parse(golden('scan-response-200.golden.json'));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.mealKcal).toBe(parsed.items[0]?.kcal);
  });

  it.each([
    ['error-402-free-limit.golden.json', 'FREE_LIMIT_REACHED'],
    ['error-404-barcode-not-found.golden.json', 'BARCODE_NOT_FOUND'],
    ['error-422-vlm-schema.golden.json', 'VLM_SCHEMA_ERROR'],
  ])('parses the %s error envelope', (file, code) => {
    expect(ErrorEnvelopeSchema.parse(golden(file)).error.code).toBe(code);
  });

  it('parses the webhook grant event and maps it to a grant policy', () => {
    const envelope = RcWebhookEnvelopeSchema.parse(golden('webhook-grant-event.golden.json'));
    expect(eventTypePolicy(envelope.event.type)).toBe('grant');
    const events = toWebhookEvent(envelope);
    expect(events).toHaveLength(1);
    expect(events[0]?.active).toBe(true);
    expect(events[0]?.supabaseUserId).toBe('bf4c7ac2-1d3e-4a2b-9c1d-5e6f7a8b9c0d');
  });

  it('parses the barcode lookup request', () => {
    const request = ScanRequestSchema.parse(golden('scan-request-barcode.golden.json'));
    expect(LookupBarcodeRequestSchema.parse({ barcode: request.barcode }).barcode).toBe('3017620422003');
  });
});

describe('the VLM never outputs kcal (contract layer)', () => {
  const item = {
    label: 'chicken-rice',
    grams: 320,
    gramsBasis: 'estimated',
    confidence: 0.92,
    hiddenFatLikely: false,
  };

  it('VlmItemSchema rejects an object carrying a kcal key', () => {
    expect(VlmItemSchema.safeParse({ ...item, kcal: 464 }).success).toBe(false);
  });

  it('VlmOutputSchema rejects a kcal key on an item and at the output level', () => {
    expect(VlmOutputSchema.safeParse({ isFood: true, items: [{ ...item, kcal: 464 }], scanConfidence: 0.9 }).success).toBe(false);
    expect(VlmOutputSchema.safeParse({ isFood: true, items: [item], scanConfidence: 0.9, kcal: 464 }).success).toBe(false);
    expect(VlmOutputSchema.safeParse({ isFood: true, items: [item], scanConfidence: 0.9 }).success).toBe(true);
  });

  it('ScanResponseSchema rejects a response that adds an unknown key', () => {
    const response = golden('scan-response-200.golden.json') as Record<string, unknown>;
    expect(ScanResponseSchema.safeParse({ ...response, model: 'x' }).success).toBe(false);
  });
});
