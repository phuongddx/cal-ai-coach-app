import {
  parseGroundedFood,
  Per100gSchema,
  type FoodNotFound,
  type GroundedFood,
  type GroundingResult,
  type Per100g,
} from '@coachcal/api-contract';

import * as fatsecret from './fatsecret';
import * as fdc from './fdc';
import * as off from './off';
import { barcodeCacheKey, searchCacheKey, toEan13 } from './normalize';

/**
 * Grounding cascade: cache-first, locked tier precedence (ported from
 * _shared/grounding/cascade.ts).
 *
 * Barcodes run fdc, then off, then fatsecret. Free-text search grounds from FDC
 * only, then types the miss: OFF exposes no search tier and FatSecret is
 * credential-gated. Every terminal resolution persists to food_cache under the
 * normalized key: positive per-100g payloads for 30 days (barcode) / 7 days
 * (search), {notFound:true} rows for 24 hours. Provider failures raise
 * UpstreamError and write no cache row, so a transient outage cannot poison the
 * cache. Tier resolvers are injectable so tests substitute recording stubs.
 *
 * The cache is a port (`CacheStore`) instead of the service-role Supabase client:
 * the API role holds no table privileges, so the Postgres adapter (`cacheStore.ts`)
 * goes through the cache_get / cache_put functions.
 */

export type CacheSource = 'fdc' | 'off' | 'fatsecret' | 'negative';

export interface CacheStore {
  /** The payload of an unexpired row for `key`, or null (a miss or an expired row). */
  get(key: string): Promise<unknown | null>;
  put(key: string, source: CacheSource, payload: unknown, ttlMs: number): Promise<void>;
}

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
  cache: CacheStore,
  barcode: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveWithCache(cache, barcodeCacheKey(toEan13(barcode)), POSITIVE_BARCODE_TTL_MS, () =>
    runBarcodeTiers(tiers, barcode),
  );
}

export function resolveSearch(
  cache: CacheStore,
  label: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveWithCache(cache, searchCacheKey(label), POSITIVE_SEARCH_TTL_MS, () =>
    tiers.fdc.resolveSearch(label),
  );
}

export function resolveFood(
  cache: CacheStore,
  query: string,
  tiers: CascadeTiers = defaultTiers(),
): Promise<GroundingResult> {
  return resolveSearch(cache, query, tiers);
}

async function runBarcodeTiers(tiers: CascadeTiers, barcode: string): Promise<GroundingResult> {
  for (const tier of [tiers.fdc, tiers.off, tiers.fatsecret]) {
    const result = await tier.resolveBarcode(barcode);
    if ('per100g' in result) return result;
  }
  return NOT_FOUND;
}

async function resolveWithCache(
  cache: CacheStore,
  key: string,
  positiveTtlMs: number,
  runTiers: () => Promise<GroundingResult>,
): Promise<GroundingResult> {
  const cached = await lookupCache(cache, key);
  if (cached) return cached;
  const result = await runTiers();
  if ('per100g' in result) {
    // The cascade's normalized key (not the tier's suggestion) is the cache
    // identity; the payload is schema-validated before anything persists.
    const grounded = parseGroundedFood({ ...result, cacheKey: key });
    if (!grounded || grounded.source === 'cache') return NOT_FOUND;
    await writePositiveCache(cache, key, grounded.source, grounded.per100g, positiveTtlMs);
    return grounded;
  }
  await cache.put(key, 'negative', { notFound: true }, NEGATIVE_TTL_MS);
  return NOT_FOUND;
}

async function lookupCache(cache: CacheStore, key: string): Promise<GroundingResult | null> {
  const payload = await cache.get(key);
  if (payload === null || payload === undefined) return null;
  if (isNegativePayload(payload)) return NOT_FOUND;
  const parsed = Per100gSchema.safeParse(payload);
  // A payload that no longer satisfies the contract is treated as a miss:
  // cache poisoning must never flow into arithmetic (T-02-09).
  if (!parsed.success) return null;
  return { source: 'cache', cacheKey: key, per100g: parsed.data };
}

function isNegativePayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { notFound?: unknown }).notFound === true
  );
}

function writePositiveCache(
  cache: CacheStore,
  key: string,
  source: 'fdc' | 'off' | 'fatsecret',
  per100g: Per100g,
  ttlMs: number,
): Promise<void> {
  return cache.put(key, source, per100g, ttlMs);
}
