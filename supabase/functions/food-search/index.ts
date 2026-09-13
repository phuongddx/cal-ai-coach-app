import { getServiceClient, getUserClient } from '../_shared/db.ts';
import { errorJson, json, preflight, zodIssues } from '../_shared/http.ts';
import { resolveSearch } from '../_shared/grounding/cascade.ts';
import { GroundedFoodSchema, UpstreamError } from '../_shared/contracts/food.ts';
import { FoodSearchRequestSchema } from '../_shared/contracts/lookup.ts';

/**
 * food-search — grounded per-100g results for one free-text query, or a
 * typed 404. A thin authenticated wrapper over the grounding cascade (FDC
 * search tier, 7-day cache TTL): no VLM and no quota — manual-logging
 * lookups are unlimited by design (TRU-02); only analyze-food counts
 * scans. A zero-hit search is a typed miss, never an empty 200.
 */

export async function handler(req: Request): Promise<Response> {
  try {
    const cors = preflight(req);
    if (cors) return cors;

    const raw = await req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return errorJson(400, 'VALIDATION_ERROR', ['body must be valid JSON']);
    }
    const parsedRequest = FoodSearchRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return errorJson(400, 'VALIDATION_ERROR', zodIssues(parsedRequest.error));
    }

    const userClient = getUserClient(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorJson(401, 'UNAUTHORIZED');

    const grounded = await resolveSearch(getServiceClient(), parsedRequest.data.query);
    if (!('per100g' in grounded)) {
      return errorJson(404, 'FOOD_NOT_FOUND', ['no grounding source resolved this query']);
    }
    return json(200, { results: [GroundedFoodSchema.parse(grounded)] });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return errorJson(502, 'UPSTREAM_ERROR');
    }
    return errorJson(500, 'INTERNAL');
  }
}

if (import.meta.main) Deno.serve(handler);
