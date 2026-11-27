import {
  ERROR_CODES,
  ErrorEnvelopeSchema,
  ScanItemResponseSchema,
  ScanRequestSchema,
  ScanResponseSchema,
  VlmItemSchema,
  VlmOutputSchema,
} from '@coachcal/api-contract';

const validScanRequest = {
  scanId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
  kind: 'photo',
  imageBase64: 'aGVsbG8=',
};

const validVlmItem = {
  label: 'Grilled chicken breast',
  grams: 150,
  gramsBasis: 'estimated',
  confidence: 0.82,
};

const validVlmOutput = {
  isFood: true,
  items: [validVlmItem],
  scanConfidence: 0.8,
};

const validScanItemResponse = {
  label: 'Grilled chicken breast',
  grams: 150,
  gramsBasis: 'estimated',
  confidence: 0.82,
  hiddenFatLikely: false,
  source: 'fdc',
  per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 },
  kcal: 248,
  proteinG: 46.5,
  carbsG: 0,
  fatG: 5.4,
  fiberG: 0,
  unresolved: false,
};

const validScanResponse = {
  scanId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
  kind: 'photo',
  items: [validScanItemResponse],
  mealKcal: 248,
  scanConfidence: 0.8,
  note: null,
};

it('ScanRequestSchema accepts a valid photo request', () => {
  ScanRequestSchema.parse(validScanRequest);
});

it('ScanRequestSchema rejects an unknown top-level key', () => {
  expect(() => ScanRequestSchema.parse({ ...validScanRequest, channel: 'ios' })).toThrow();
});

it('ScanRequestSchema has no client-settable fixture/mode field', () => {
  expect(() => ScanRequestSchema.parse({ ...validScanRequest, mode: 'malformed' })).toThrow();
});

it('ScanRequestSchema rejects a malformed scanId', () => {
  expect(() => ScanRequestSchema.parse({ ...validScanRequest, scanId: 'not-a-uuid' })).toThrow();
});

it('ScanRequestSchema rejects an unknown kind', () => {
  expect(() => ScanRequestSchema.parse({ ...validScanRequest, kind: 'voice' })).toThrow();
});

it('ScanRequestSchema rejects a photo without imageBase64', () => {
  const missing = {
    scanId: validScanRequest.scanId,
    kind: 'photo' as const,
  };
  expect(() => ScanRequestSchema.parse(missing)).toThrow();
});

it('ScanRequestSchema rejects a barcode request without a barcode', () => {
  const missing = {
    scanId: validScanRequest.scanId,
    kind: 'barcode' as const,
  };
  expect(() => ScanRequestSchema.parse(missing)).toThrow();
});

it('ScanRequestSchema rejects a barcode failing the digit regex', () => {
  const malformed = {
    ...validScanRequest,
    kind: 'barcode',
    imageBase64: undefined,
    barcode: '12abc34',
  };
  expect(() => ScanRequestSchema.parse(malformed)).toThrow();
});

it('ScanRequestSchema only accepts barcodes with a GTIN-normalizable length', () => {
  for (const good of ['12345678', '036000291452', '3017620422003', '00036000291452']) {
    ScanRequestSchema.parse({
      ...validScanRequest,
      kind: 'barcode',
      imageBase64: undefined,
      barcode: good,
    });
  }
  for (const bad of ['123456789', '1234567890', '12345678901', '10000000000000', '12345678901234']) {
    expect(() => ScanRequestSchema.parse({
        ...validScanRequest,
        kind: 'barcode',
        imageBase64: undefined,
        barcode: bad,
      })).toThrow();
  }
});

it('VlmItemSchema rejects an object carrying a kcal key', () => {
  const poisoned = { ...validVlmItem, kcal: 248 };
  const result = VlmItemSchema.safeParse(poisoned);
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.success ? [] : result.error.issues)).toContain('kcal');
});

it('VlmOutputSchema rejects an item carrying a kcal key', () => {
  const poisoned = {
    ...validVlmOutput,
    items: [{ ...validVlmItem, kcal: 248 }],
  };
  const result = VlmOutputSchema.safeParse(poisoned);
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.success ? [] : result.error.issues)).toContain('kcal');
});

it('VlmOutputSchema rejects a kcal key at the output level', () => {
  const poisoned = { ...validVlmOutput, kcal: 248 };
  const result = VlmOutputSchema.safeParse(poisoned);
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.success ? [] : result.error.issues)).toContain('kcal');
});

it('ScanItemResponseSchema accepts a grounded item response', () => {
  ScanItemResponseSchema.parse(validScanItemResponse);
});

it('ScanItemResponseSchema rejects an unknown source', () => {
  const badSource = { ...validScanItemResponse, source: 'chatgpt' };
  expect(() => ScanItemResponseSchema.parse(badSource)).toThrow();
});

it('ScanResponseSchema accepts a valid response', () => {
  ScanResponseSchema.parse(validScanResponse);
});

it('ScanResponseSchema rejects a kcal key', () => {
  expect(() => ScanResponseSchema.parse({ ...validScanResponse, kcal: 248 })).toThrow();
});

it('every ERROR_CODE builds a valid ErrorEnvelopeSchema value', () => {
  for (const code of ERROR_CODES) {
    ErrorEnvelopeSchema.parse({ error: { code } });
  }
  ErrorEnvelopeSchema.parse({
    error: {
      code: 'VLM_SCHEMA_ERROR',
      details: ['items.0'],
    },
  });
  ErrorEnvelopeSchema.parse({
    error: {
      code: 'FREE_LIMIT_REACHED',
      entitlement: {
        tier: 'free',
        scansUsed: 3,
        scanLimit: 3,
        windowResetAt: '2026-09-18T10:00:00.000Z',
      },
    },
  });
});

it('ErrorEnvelopeSchema rejects an unknown code', () => {
  expect(() => ErrorEnvelopeSchema.parse({ error: { code: 'TEAPOT' } })).toThrow();
});
