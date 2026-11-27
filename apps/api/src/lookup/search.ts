import { FoodSearchRequestSchema, GroundedFoodSchema } from '@coachcal/api-contract';

import type { Db } from '../db';
import { resolveSearch, type CascadeTiers } from '../grounding/cascade';
import { dbCacheStore } from '../grounding/cacheStore';
import { errorJson, json } from '../http';

/**
 * food search: grounded per-100g results for one free-text query, or a typed 404. A
 * thin wrapper over the grounding cascade (FDC search tier, 7-day cache TTL): no VLM
 * and no quota (TRU-02). A zero-hit search is a typed miss, never an empty 200.
 * Ported from food-search/index.ts.
 */
export const searchRequestSchema = FoodSearchRequestSchema;

export async function foodSearch(
  db: Db,
  userId: string,
  query: string,
  tiers?: CascadeTiers,
): Promise<Response> {
  const grounded = await resolveSearch(dbCacheStore(db, userId), query, tiers);
  if (!('per100g' in grounded)) {
    return errorJson(404, 'FOOD_NOT_FOUND', ['no grounding source resolved this query']);
  }
  return json(200, { results: [GroundedFoodSchema.parse(grounded)] });
}
