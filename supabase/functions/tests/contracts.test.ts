import { assert, assertThrows } from 'jsr:@std/assert';
import {
  ScanRequestSchema,
  ScanItemResponseSchema,
  ScanResponseSchema,
} from '../_shared/contracts/scan.ts';
import { VlmItemSchema, VlmOutputSchema } from '../_shared/contracts/vlm.ts';
import { ERROR_CODES, ErrorEnvelopeSchema } from '../_shared/contracts/errors.ts';

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

Deno.test('ScanRequestSchema accepts a valid photo request', () => {
  ScanRequestSchema.parse(validScanRequest);
});

Deno.test('ScanRequestSchema rejects an unknown top-level key', () => {
  assertThrows(() => ScanRequestSchema.parse({ ...validScanRequest, channel: 'ios' }));
});

Deno.test('ScanRequestSchema has no client-settable fixture/mode field', () => {
  assertThrows(() =>
    ScanRequestSchema.parse({ ...validScanRequest, mode: 'malformed' })
  );
});

Deno.test('ScanRequestSchema rejects a malformed scanId', () => {
  assertThrows(() => ScanRequestSchema.parse({ ...validScanRequest, scanId: 'not-a-uuid' }));
});

Deno.test('ScanRequestSchema rejects an unknown kind', () => {
  assertThrows(() => ScanRequestSchema.parse({ ...validScanRequest, kind: 'voice' }));
});

Deno.test('ScanRequestSchema rejects a photo without imageBase64', () => {
  const missing = {
    scanId: validScanRequest.scanId,
    kind: 'photo' as const,
  };
  assertThrows(() => ScanRequestSchema.parse(missing));
});

Deno.test('ScanRequestSchema rejects a barcode request without a barcode', () => {
  const missing = {
    scanId: validScanRequest.scanId,
    kind: 'barcode' as const,
  };
  assertThrows(() => ScanRequestSchema.parse(missing));
});

Deno.test('ScanRequestSchema rejects a barcode failing the digit regex', () => {
  const malformed = {
    ...validScanRequest,
    kind: 'barcode',
    imageBase64: undefined,
    barcode: '12abc34',
  };
  assertThrows(() => ScanRequestSchema.parse(malformed));
});

Deno.test('VlmItemSchema rejects an object carrying a kcal key', () => {
  const poisoned = { ...validVlmItem, kcal: 248 };
  const result = VlmItemSchema.safeParse(poisoned);
  assert(!result.success);
  assert(JSON.stringify(result.error.issues).includes('kcal'));
});

Deno.test('VlmOutputSchema rejects an item carrying a kcal key', () => {
  const poisoned = {
    ...validVlmOutput,
    items: [{ ...validVlmItem, kcal: 248 }],
  };
  const result = VlmOutputSchema.safeParse(poisoned);
  assert(!result.success);
  assert(JSON.stringify(result.error.issues).includes('kcal'));
});

Deno.test('VlmOutputSchema rejects a kcal key at the output level', () => {
  const poisoned = { ...validVlmOutput, kcal: 248 };
  const result = VlmOutputSchema.safeParse(poisoned);
  assert(!result.success);
  assert(JSON.stringify(result.error.issues).includes('kcal'));
});

Deno.test('ScanItemResponseSchema accepts a grounded item response', () => {
  ScanItemResponseSchema.parse(validScanItemResponse);
});

Deno.test('ScanItemResponseSchema rejects an unknown source', () => {
  const badSource = { ...validScanItemResponse, source: 'chatgpt' };
  assertThrows(() => ScanItemResponseSchema.parse(badSource));
});

Deno.test('ScanResponseSchema accepts a valid response', () => {
  ScanResponseSchema.parse(validScanResponse);
});

Deno.test('ScanResponseSchema rejects a kcal key', () => {
  assertThrows(() => ScanResponseSchema.parse({ ...validScanResponse, kcal: 248 }));
});

Deno.test('every ERROR_CODE builds a valid ErrorEnvelopeSchema value', () => {
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

Deno.test('ErrorEnvelopeSchema rejects an unknown code', () => {
  assertThrows(() =>
    ErrorEnvelopeSchema.parse({ error: { code: 'TEAPOT' } })
  );
});
