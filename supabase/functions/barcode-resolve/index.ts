import { getServiceClient, getUserClient } from '../_shared/db.ts';
import { errorJson, json, preflight, zodIssues } from '../_shared/http.ts';
import { resolveBarcode } from '../_shared/grounding/cascade.ts';
import { GroundedFoodSchema, UpstreamError } from '../_shared/contracts/food.ts';
import { LookupBarcodeRequestSchema } from '../_shared/contracts/lookup.ts';

/**
 * barcode-resolve — exact packaged nutrition for one barcode, or a typed
 * 404. A thin authenticated wrapper over the grounding cascade: no VLM and
 * no quota — manual-logging lookups are unlimited by design (TRU-02); only
 * analyze-food counts scans. An unknown barcode is a typed answer, never a
 * guess, and an upstream provider failure is a retryable 502.
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
    const parsedRequest = LookupBarcodeRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return errorJson(400, 'VALIDATION_ERROR', zodIssues(parsedRequest.error));
    }

    const userClient = getUserClient(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorJson(401, 'UNAUTHORIZED');

    const grounded = await resolveBarcode(getServiceClient(), parsedRequest.data.barcode);
    if (!('per100g' in grounded)) {
      return errorJson(404, 'BARCODE_NOT_FOUND', ['no grounding source resolved this barcode']);
    }
    return json(200, GroundedFoodSchema.parse(grounded));
  } catch (error) {
    if (error instanceof UpstreamError) {
      return errorJson(502, 'UPSTREAM_ERROR');
    }
    return errorJson(500, 'INTERNAL');
  }
}

if (import.meta.main) Deno.serve(handler);
