import { GroundedFoodSchema, LookupBarcodeRequestSchema } from '@coachcal/api-contract';

import type { Db } from '../db';
import { resolveBarcode, type CascadeTiers } from '../grounding/cascade';
import { dbCacheStore } from '../grounding/cacheStore';
import { errorJson, json } from '../http';

/**
 * barcode lookup: exact packaged nutrition for one barcode, or a typed 404. A thin
 * wrapper over the grounding cascade: no VLM and no quota (manual-logging lookups
 * are unlimited by design, TRU-02); only the scan route counts scans. An unknown
 * barcode is a typed answer, never a guess; an upstream provider failure is the
 * UpstreamError the route maps to a retryable 502. Ported from barcode-resolve/index.ts.
 */
export const barcodeRequestSchema = LookupBarcodeRequestSchema;

export async function barcodeLookup(
  db: Db,
  userId: string,
  barcode: string,
  tiers?: CascadeTiers,
): Promise<Response> {
  const grounded = await resolveBarcode(dbCacheStore(db, userId), barcode, tiers);
  if (!('per100g' in grounded)) {
    return errorJson(404, 'BARCODE_NOT_FOUND', ['no grounding source resolved this barcode']);
  }
  return json(200, GroundedFoodSchema.parse(grounded));
}
