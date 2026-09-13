import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  parseGroundedFood,
  Per100gSchema,
  type FoodNotFound,
  type GroundedFood,
  type GroundingResult,
} from '../contracts/food.ts';
import type { Per100g } from '../contracts/scan.ts';
import * as fdc from './fdc.ts';
import * as fatsecret from './fatsecret.ts';
import * as off from './off.ts';
import { barcodeCacheKey, searchCacheKey, toEan13 } from './normalize.ts';

/**
 * Grounding cascade — cache-first, locked tier precedence.
 *
 * Barcodes run fdc → off → fatsecret. Free-text search grounds from FDC
 * only, then types the miss: OFF exposes no search tier and FatSecret is
 * credential-gated until Phase 4. Every terminal resolution persists to
 * food_cache under the normalized key — positive per-100g payloads for 30
 * days (barcode) / 7 days (search), {notFound:true} rows for 24 hours.
 * Provider failures raise UpstreamError and write no cache row, so a
 * transient outage cannot poison the cache. Tier resolvers are injectable
 * so tests substitute recording stubs without touching globalThis.
 */

export interface BarcodeTier {
  resolveBarcode(barcode: string): Promise<GroundingResult>;
}

export interface SearchTier {
  resolveSearch(label: string): Promise<GroundingResult>;
}

export interface CascadeTiers {
  fdc: BarcodeTier & SearchTier;
  off: BarcodeTier;
  fatsecret: BarcodeTier;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const POSITIVE_BARCODE_TTL_MS = 30 * DAY_MS;
const POSITIVE_SEARCH_TTL_MS = 7 * DAY_MS;
const NEGATIVE_TTL_MS = DAY_MS;

const NOT_FOUND: FoodNotFound = { kind: 'not_found' };

const defaultTiers = (): CascadeTiers => ({ fdc, off, fatsecret });

export { barcodeCacheKey, searchCacheKey, toEan13 };
export type { FoodNotFound, GroundedFood, GroundingResult };

export function resolveBarcode(
  serviceClient: SupabaseClient,
  barcode: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveWithCache(
    serviceClient,
    barcodeCacheKey(toEan13(barcode)),
    POSITIVE_BARCODE_TTL_MS,
    () => runBarcodeTiers(tiers, barcode),
  );
}

export function resolveSearch(
  serviceClient: SupabaseClient,
  label: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveWithCache(
    serviceClient,
    searchCacheKey(label),
    POSITIVE_SEARCH_TTL_MS,
    () => tiers.fdc.resolveSearch(label),
  );
}

export function resolveFood(
  serviceClient: SupabaseClient,
  query: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveSearch(serviceClient, query, tiers);
}

async function runBarcodeTiers(tiers: CascadeTiers, barcode: string): Promise<GroundingResult> {
  for (const tier of [tiers.fdc, tiers.off, tiers.fatsecret]) {
    const result = await tier.resolveBarcode(barcode);
    if ('per100g' in result) return result;
  }
  return NOT_FOUND;
}

async function resolveWithCache(
  serviceClient: SupabaseClient,
  key: string,
  positiveTtlMs: number,
  runTiers: () => Promise<GroundingResult>,
): Promise<GroundingResult> {
  const cached = await lookupCache(serviceClient, key);
  if (cached) return cached;
  const result = await runTiers();
  if ('per100g' in result) {
    // The cascade's normalized key (not the tier's suggestion) is the cache
    // identity; the payload is schema-validated before anything persists.
    const grounded = parseGroundedFood({ ...result, cacheKey: key });
    if (!grounded || grounded.source === 'cache') return NOT_FOUND;
    await writePositiveCache(
      serviceClient,
      key,
      grounded.source,
      grounded.per100g,
      positiveTtlMs,
    );
    return grounded;
  }
  await writeNegativeCache(serviceClient, key);
  return NOT_FOUND;
}

async function lookupCache(
  serviceClient: SupabaseClient,
  key: string,
): Promise<GroundingResult | null> {
  const { data, error } = await serviceClient
    .from('food_cache')
    .select('payload')
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const payload = data.payload as unknown;
  if (isNegativePayload(payload)) return NOT_FOUND;
  const parsed = Per100gSchema.safeParse(payload);
  // A payload that no longer satisfies the contract is treated as a miss —
  // cache poisoning must never flow into arithmetic (T-02-09).
  if (!parsed.success) return null;
  return { source: 'cache', cacheKey: key, per100g: parsed.data };
}

function isNegativePayload(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null &&
    (payload as { notFound?: unknown }).notFound === true;
}

async function writePositiveCache(
  serviceClient: SupabaseClient,
  key: string,
  source: 'fdc' | 'off' | 'fatsecret',
  per100g: Per100g,
  ttlMs: number,
): Promise<void> {
  const { error } = await serviceClient.from('food_cache').upsert({
    cache_key: key,
    source,
    payload: per100g,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
  if (error) throw error;
}

async function writeNegativeCache(serviceClient: SupabaseClient, key: string): Promise<void> {
  const { error } = await serviceClient.from('food_cache').upsert({
    cache_key: key,
    source: 'negative',
    payload: { notFound: true },
    expires_at: new Date(Date.now() + NEGATIVE_TTL_MS).toISOString(),
  });
  if (error) throw error;
}
