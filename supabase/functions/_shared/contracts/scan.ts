import { z } from 'npm:zod';
import { gramsBasisSchema } from './vlm.ts';

/**
 * Scan request/response vocabulary — the ONLY shapes crossing the
 * client↔analyze-food boundary. scanId is the client-generated idempotency
 * key used by the quota claim; ownership and fixture behavior are always
 * server-derived (server env), never client hints. All object schemas are
 * strict: unknown keys are rejected at the boundary.
 */

export const scanKindSchema = z.enum(['photo', 'label', 'text', 'barcode']);
export type ScanKind = z.infer<typeof scanKindSchema>;

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof mealTypeSchema>;

export const ScanRequestSchema = z
  .strictObject({
    scanId: z.uuid(),
    kind: scanKindSchema,
    mealType: mealTypeSchema.optional(),
    imageBase64: z.string().max(4_500_000).optional(),
    textDescription: z.string().min(1).max(500).optional(),
    barcode: z.string().regex(/^\d{8,14}$/).optional(),
  })
  .refine(
    (request) =>
      request.kind === 'photo' || request.kind === 'label'
        ? request.imageBase64 != null
        : request.kind === 'text'
          ? request.textDescription != null
          : request.barcode != null,
    'payload must match kind'
  );
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/** Macros travel at 0.1 g precision — the arithmetic module's output rule. */
const macroGrams = z
  .number()
  .min(0)
  .refine(
    (grams) => Number.isInteger(Math.round(grams * 10)),
    'macros carry at most 0.1 g precision'
  );

export const Per100gSchema = z.strictObject({
  kcal: z.number().int().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0),
});
export type Per100g = z.infer<typeof Per100gSchema>;

export const ScanItemResponseSchema = z.strictObject({
  label: z.string().min(1),
  grams: z.number().positive(),
  gramsBasis: gramsBasisSchema,
  confidence: z.number().min(0).max(1),
  hiddenFatLikely: z.boolean(),
  source: z.enum(['cache', 'fdc', 'off', 'fatsecret', 'none']),
  per100g: Per100gSchema,
  kcal: z.number().int().min(0),
  proteinG: macroGrams,
  carbsG: macroGrams,
  fatG: macroGrams,
  fiberG: macroGrams,
  unresolved: z.boolean().default(false),
});
export type ScanItemResponse = z.infer<typeof ScanItemResponseSchema>;

export const ScanResponseSchema = z.strictObject({
  scanId: z.uuid(),
  kind: scanKindSchema,
  items: z.array(ScanItemResponseSchema).max(20),
  mealKcal: z.number().int().min(0),
  scanConfidence: z.number().min(0).max(1),
  note: z.string().nullable(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;
