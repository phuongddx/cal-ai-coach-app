import { z } from 'npm:zod';

/**
 * Lookup request vocabulary — the ONLY shapes crossing the client↔
 * {barcode-resolve, food-search} boundary. All object schemas are strict:
 * unknown keys are rejected at the boundary. Blank search input is rejected
 * beyond the min-1 length rule so a whitespace-only query can never reach
 * the cascade as an empty search.
 */

export const LookupBarcodeRequestSchema = z.strictObject({
  barcode: z.string().regex(/^\d{8,14}$/),
});
export type LookupBarcodeRequest = z.infer<typeof LookupBarcodeRequestSchema>;

export const FoodSearchRequestSchema = z.strictObject({
  query: z.string().min(1).max(120).refine(
    (query) => query.trim().length > 0,
    'query must not be blank',
  ),
});
export type FoodSearchRequest = z.infer<typeof FoodSearchRequestSchema>;
