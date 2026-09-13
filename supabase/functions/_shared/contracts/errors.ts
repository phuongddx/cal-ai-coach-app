import { z } from 'npm:zod';

/**
 * Typed error envelope — the ONLY error shape crossing the
 * client↔server boundary. Never echoes env/provider detail; 500 INTERNAL is
 * the only untyped path and must stay unreachable for known failure modes.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FREE_LIMIT_REACHED',
  'FOOD_NOT_FOUND',
  'BARCODE_NOT_FOUND',
  'VLM_SCHEMA_ERROR',
  'UPSTREAM_ERROR',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const EntitlementStateSchema = z.strictObject({
  tier: z.enum(['free', 'premium']),
  scansUsed: z.number().int().nonnegative(),
  scanLimit: z.number().int().nonnegative(),
  windowResetAt: z.iso.datetime({ offset: true }),
});
export type EntitlementState = z.infer<typeof EntitlementStateSchema>;

export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    details: z.array(z.string()).optional(),
    entitlement: EntitlementStateSchema.optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
