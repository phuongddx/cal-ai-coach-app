import {
  parseGroundedFood,
  UpstreamError,
  type GroundingResult,
} from '../contracts/food.ts';
import { Per100gSchema, type Per100g } from '../contracts/scan.ts';
import { barcodeCacheKey, searchCacheKey, toEan13, toUpca } from './normalize.ts';

/**
 * Cascade tier 1 — USDA FDC. Energy is mapped by preference 1008 → 2047 →
 * 2048 restricted to unitName KCAL: Foundation foods (the best data) carry
 * only the Atwater ids 2047/2048, so a 1008-only lookup silently zeroes
 * whole foods (research Pitfall 1). Barcode queries are tried in both
 * UPC-A and EAN-13 forms because raw EAN-13 strings miss Branded rows
 * whose gtinUpc is UPC-A (research Pitfall 2). All fetches flow through
 * the fdcFetch seam so tests stub one place.
 */

const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const ENERGY_NUTRIENT_IDS = [1008, 2047, 2048] as const;
const MACRO_NUTRIENT_IDS = { proteinG: 1003, carbsG: 1005, fatG: 1004, fiberG: 1079 } as const;

export type FetchSeam = (url: string, init?: RequestInit) => Promise<Response>;
export const fdcFetch: { impl: FetchSeam } = { impl: (url, init) => fetch(url, init) };

export interface FdcNutrient {
  value: number;
  unitName?: string;
  nutrientId?: number;
  nutrient?: { id?: number };
}

export interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  gtinUpc?: string | null;
  foodNutrients?: FdcNutrient[];
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

export function mapFdcNutrients(food: FdcFood): Per100g | null {
  let kcal: number | null = null;
  for (const id of ENERGY_NUTRIENT_IDS) {
    const nutrient = nutrientValue(food, id);
    if (nutrient && nutrient.unitName?.toUpperCase() === 'KCAL') {
      kcal = Math.round(nutrient.value);
      break;
    }
  }
  if (kcal === null) return null;
  const grams = (id: number) => nutrientValue(food, id)?.value ?? 0;
  const parsed = Per100gSchema.safeParse({
    kcal,
    proteinG: grams(MACRO_NUTRIENT_IDS.proteinG),
    carbsG: grams(MACRO_NUTRIENT_IDS.carbsG),
    fatG: grams(MACRO_NUTRIENT_IDS.fatG),
    fiberG: grams(MACRO_NUTRIENT_IDS.fiberG),
  });
  return parsed.success ? parsed.data : null;
}

function nutrientValue(food: FdcFood, id: number): FdcNutrient | undefined {
  return food.foodNutrients?.find((n) => (n.nutrientId ?? n.nutrient?.id) === id);
}

export async function resolveBarcode(barcode: string): Promise<GroundingResult> {
  const key = barcodeCacheKey(toEan13(barcode));
  const variants = barcodeVariants(barcode);
  for (const variant of variants) {
    const response = await fdcSearch({ query: variant, dataType: 'Branded' });
    const match = findGtinMatch(response, variants);
    if (!match) continue;
    const per100g = mapFdcNutrients(match);
    if (!per100g) continue;
    const grounded = parseGroundedFood({ source: 'fdc', cacheKey: key, per100g });
    if (grounded) return grounded;
  }
  return { kind: 'not_found' };
}

export async function resolveSearch(label: string): Promise<GroundingResult> {
  const response = await fdcSearch({
    query: label.trim(),
    dataType: 'Foundation,SR Legacy,Branded',
  });
  for (const food of response.foods ?? []) {
    const per100g = mapFdcNutrients(food);
    if (!per100g) continue;
    const grounded = parseGroundedFood({
      source: 'fdc',
      cacheKey: searchCacheKey(label),
      per100g,
    });
    if (grounded) return grounded;
  }
  return { kind: 'not_found' };
}

async function fdcSearch(params: Record<string, string>): Promise<FdcSearchResponse> {
  const search = new URLSearchParams({
    api_key: Deno.env.get('USDA_FDC_API_KEY') ?? 'DEMO_KEY',
    ...params,
  });
  let response: Response;
  try {
    response = await fdcFetch.impl(`${FDC_SEARCH_URL}?${search}`);
  } catch {
    throw new UpstreamError('fdc search request failed');
  }
  if (!response.ok) throw new UpstreamError('fdc search returned a non-OK status');
  return await response.json() as FdcSearchResponse;
}

function barcodeVariants(barcode: string): string[] {
  const variants: string[] = [];
  for (const toVariant of [toUpca, toEan13]) {
    try {
      variants.push(toVariant(barcode));
    } catch {
      // a length without that GTIN form simply contributes no variant
    }
  }
  return [...new Set(variants)];
}

function findGtinMatch(response: FdcSearchResponse, variants: string[]): FdcFood | undefined {
  const wanted = new Set(variants);
  return response.foods?.find((food) => {
    const gtin = food.gtinUpc?.replace(/\D/g, '');
    return gtin !== undefined && gtin !== '' && wanted.has(gtin);
  });
}
