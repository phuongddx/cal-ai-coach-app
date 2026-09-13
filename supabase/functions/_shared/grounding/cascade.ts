import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { type Per100g, Per100gSchema } from '../contracts/scan.ts';

/**
 * Grounding cascade skeleton. Plan 02-07 ships the food_cache lookup with a
 * real typed miss; 02-02 fills the FDC → OFF → FatSecret tier chain and the
 * cache write behind these exact signatures, so callers never change.
 */

export interface GroundedFood {
  source: 'cache' | 'fdc' | 'off' | 'fatsecret';
  cacheKey: string;
  per100g: Per100g;
}

export interface FoodNotFound {
  kind: 'not_found';
}

export type GroundingResult = GroundedFood | FoodNotFound;

const NOT_FOUND: FoodNotFound = { kind: 'not_found' };

export function searchCacheKey(label: string): string {
  return `search:${label.trim().toLowerCase()}`;
}

export function barcodeCacheKey(barcode: string): string {
  return `barcode:${barcode.replace(/\D/g, '')}`;
}

async function lookupCache(
  serviceClient: SupabaseClient,
  cacheKey: string,
): Promise<GroundedFood | FoodNotFound> {
  const { data, error } = await serviceClient
    .from('food_cache')
    .select('source, payload')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return NOT_FOUND;
  // A payload that no longer satisfies the contract is treated as a miss —
  // cache poisoning must never flow into arithmetic (T-02-09).
  const parsed = Per100gSchema.safeParse(data.payload);
  if (!parsed.success) return NOT_FOUND;
  return { source: 'cache', cacheKey, per100g: parsed.data };
}

export function resolveSearch(
  serviceClient: SupabaseClient,
  label: string,
): Promise<GroundingResult> {
  return lookupCache(serviceClient, searchCacheKey(label));
}

export function resolveFood(
  serviceClient: SupabaseClient,
  query: string,
): Promise<GroundingResult> {
  return resolveSearch(serviceClient, query);
}

export function resolveBarcode(
  serviceClient: SupabaseClient,
  barcode: string,
): Promise<GroundingResult> {
  return lookupCache(serviceClient, barcodeCacheKey(barcode));
}
