import {
  parseGroundedFood,
  UpstreamError,
  type GroundingResult,
} from '../contracts/food.ts';
import { Per100gSchema } from '../contracts/scan.ts';
import { barcodeCacheKey, toEan13 } from './normalize.ts';

/**
 * Cascade tier 2 — Open Food Facts v2 product endpoint. OFF stores codes in
 * canonical EAN-13 form, carries nutriments per 100 g, and asks API callers
 * to identify themselves with a descriptive User-Agent. A status-0 body,
 * a missing product, or a missing energy-kcal_100g value is a typed miss —
 * never a kcal-0 grounding.
 */

const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

export type FetchSeam = (url: string, init?: RequestInit) => Promise<Response>;
export const offFetch: { impl: FetchSeam } = { impl: (url, init) => fetch(url, init) };

interface OffNutriments {
  'energy-kcal_100g'?: number;
  'proteins_100g'?: number;
  'carbohydrates_100g'?: number;
  'fat_100g'?: number;
  'fiber_100g'?: number;
}

interface OffProductBody {
  status?: number;
  product?: { nutriments?: OffNutriments };
}

function offUserAgent(): string {
  return Deno.env.get('OFF_USER_AGENT') ?? 'CoachCal/0.1 (local-dev)';
}

export async function resolveBarcode(barcode: string): Promise<GroundingResult> {
  const ean13 = toEan13(barcode);
  const params = new URLSearchParams({ fields: 'code,product_name,nutriments' });
  let response: Response;
  try {
    // A hung provider must not hold the request (and an already-claimed
    // scan credit) until the platform wall clock kills the function.
    response = await offFetch.impl(
      `${OFF_PRODUCT_URL}/${encodeURIComponent(ean13)}.json?${params}`,
      { headers: { 'User-Agent': offUserAgent() }, signal: AbortSignal.timeout(5_000) },
    );
  } catch {
    throw new UpstreamError('open food facts request failed');
  }
  if (!response.ok) throw new UpstreamError('open food facts returned a non-OK status');
  let body: OffProductBody;
  try {
    body = await response.json() as OffProductBody;
  } catch {
    throw new UpstreamError('open food facts returned a non-JSON body');
  }
  const nutriments = body.status === 1 ? body.product?.nutriments : undefined;
  const kcal = nutriments?.['energy-kcal_100g'];
  if (!nutriments || typeof kcal !== 'number' || !Number.isFinite(kcal)) {
    return { kind: 'not_found' };
  }
  const per100g = Per100gSchema.safeParse({
    kcal: Math.round(kcal),
    proteinG: nutriments['proteins_100g'] ?? 0,
    carbsG: nutriments['carbohydrates_100g'] ?? 0,
    fatG: nutriments['fat_100g'] ?? 0,
    fiberG: nutriments['fiber_100g'] ?? 0,
  });
  if (!per100g.success) return { kind: 'not_found' };
  const grounded = parseGroundedFood({
    source: 'off',
    cacheKey: barcodeCacheKey(ean13),
    per100g: per100g.data,
  });
  return grounded ?? { kind: 'not_found' };
}
