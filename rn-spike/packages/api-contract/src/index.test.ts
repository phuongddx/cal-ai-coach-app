import { ErrorEnvelopeSchema } from './index';

describe('ErrorEnvelopeSchema', () => {
  it('accepts the uniform envelope', () => {
    expect(ErrorEnvelopeSchema.parse({ error: { code: 'UNAUTHORIZED' } })).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects unknown keys (strict decoding on both ends)', () => {
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: 'X' }, extra: 1 }).success).toBe(false);
  });
});
