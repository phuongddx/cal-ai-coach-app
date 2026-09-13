import { z } from 'npm:zod';
import { Per100gSchema, type Per100g } from './scan.ts';

/**
 * Grounding vocabulary shared by the cascade and its provider tiers: one
 * normalized per-100g shape parsed at the provider boundary (T-02-09), the
 * typed all-tiers miss, and the upstream failure callers map to the 502
 * envelope. Per100g lives in scan.ts (single source of truth) and is
 * re-exported here for tier modules.
 */

export { Per100gSchema };
export type { Per100g };

export const GroundedFoodSchema = z.strictObject({
  source: z.enum(['fdc', 'off', 'fatsecret', 'cache']),
  cacheKey: z.string().min(1),
  per100g: Per100gSchema,
});
export type GroundedFood = z.infer<typeof GroundedFoodSchema>;

export interface FoodNotFound {
  kind: 'not_found';
}

export type GroundingResult = GroundedFood | FoodNotFound;

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export function parseGroundedFood(value: unknown): GroundedFood | null {
  const parsed = GroundedFoodSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
