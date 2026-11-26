import { z } from 'zod';

/** Uniform error envelope: `{ error: { code, details? } }` (same shape as the Deno backend's `_shared/http.ts`). */
export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// TODO(spike item 4): meal row, push/pull request/response schemas live here.
