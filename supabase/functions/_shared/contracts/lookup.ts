import { z } from 'npm:zod';

/**
 * Lookup request vocabulary — the ONLY shapes crossing the client↔
 * {barcode-resolve, food-search} boundary. All object schemas are strict:
 * unknown keys are rejected at the boundary. Blank search input is rejected
 * beyond the min-1 length rule so a whitespace-only query can never reach
 * the cascade as an empty search.
 */

export const LookupBarcodeRequestSchema = z.strictObject({
  // Only lengths the GTIN normalizer can key: 9-11 digits and GTIN-14 with
  // a non-zero indicator have no EAN-13 form, so they are 400s, never
  // normalizer crashes downstream.
  barcode: z.string().regex(/^(?:\d{8}|\d{12}|\d{13}|0\d{13})$/),
});
export type LookupBarcodeRequest = z.infer<typeof LookupBarcodeRequestSchema>;

export const FoodSearchRequestSchema = z.strictObject({
  query: z.string().min(1).max(120).refine(
    (query) => query.trim().length > 0,
    'query must not be blank',
  ),
});
export type FoodSearchRequest = z.infer<typeof FoodSearchRequestSchema>;
