import {
  ERROR_CODES,
  EntitlementStateSchema,
  ErrorEnvelopeSchema,
  type ErrorCode,
} from './index';

describe('ErrorEnvelopeSchema', () => {
  it('accepts the uniform envelope', () => {
    expect(ErrorEnvelopeSchema.parse({ error: { code: 'UNAUTHORIZED' } })).toEqual({
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects unknown keys (strict decoding on both ends)', () => {
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: 'X' }, extra: 1 }).success).toBe(false);
    expect(
      ErrorEnvelopeSchema.safeParse({ error: { code: 'UNAUTHORIZED' }, extra: 1 }).success,
    ).toBe(false);
  });

  it('rejects a code outside ERROR_CODES', () => {
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: 'NOT_A_CODE' } }).success).toBe(false);
  });

  it('every ERROR_CODE builds a valid envelope', () => {
    for (const code of ERROR_CODES) {
      expect(ErrorEnvelopeSchema.parse({ error: { code } }).error.code).toBe(code);
    }
  });

  it('details are an array of strings and entitlement is the typed state', () => {
    const parsed = ErrorEnvelopeSchema.parse({
      error: {
        code: 'FREE_LIMIT_REACHED',
        details: ['items.0'],
        entitlement: { tier: 'free', scansUsed: 3, scanLimit: 3, windowResetAt: '2026-09-21T10:00:00Z' },
      },
    });
    expect(parsed.error.details).toEqual(['items.0']);
    expect(EntitlementStateSchema.parse(parsed.error.entitlement).tier).toBe('free');
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: 'INTERNAL', details: 'oops' } }).success).toBe(false);
  });

  it('exposes the legacy code list unchanged', () => {
    const expected: ErrorCode[] = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FREE_LIMIT_REACHED',
      'FOOD_NOT_FOUND',
      'BARCODE_NOT_FOUND',
      'VLM_SCHEMA_ERROR',
      'UPSTREAM_ERROR',
      'INTERNAL',
    ];
    expect([...ERROR_CODES]).toEqual(expected);
  });
});
