import { z } from 'npm:zod';

/**
 * VLM output vocabulary — the ONLY shapes accepted from the vision provider.
 * The VLM is untrusted input: strict objects everywhere, so unknown keys —
 * including any kcal-shaped field, which would break the "VLM never outputs
 * kcal, deterministic arithmetic only" invariant — are rejected at the
 * boundary, not silently carried.
 */

export const gramsBasisSchema = z.enum([
  'estimated',
  'reference-object',
  'packaged-serving',
]);
export type GramsBasis = z.infer<typeof gramsBasisSchema>;

export const VlmItemSchema = z.strictObject({
  label: z.string().min(1),
  grams: z.number().positive(),
  gramsBasis: gramsBasisSchema,
  confidence: z.number().min(0).max(1),
  hiddenFatLikely: z.boolean().default(false),
});
export type VlmItem = z.infer<typeof VlmItemSchema>;

export const VlmOutputSchema = z.strictObject({
  isFood: z.boolean(),
  items: z.array(VlmItemSchema).max(20),
  scanConfidence: z.number().min(0).max(1),
  note: z.string().nullable().default(null),
});
export type VlmOutput = z.infer<typeof VlmOutputSchema>;
