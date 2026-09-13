import { UpstreamError, type GroundingResult } from '../contracts/food.ts';

/**
 * Cascade tier 3 — FatSecret adapter stub. Phase 4 credentials do not exist
 * yet, so the tier is an explicit typed miss with zero network activity;
 * the signature matches the other tiers so the real implementation slots in
 * without call-site changes. If keys are somehow present it fails closed
 * rather than pretending the tier resolved.
 */

export async function resolveBarcode(_barcode: string): Promise<GroundingResult> {
  const clientId = Deno.env.get('FATSECRET_CLIENT_ID');
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  if (!clientId || !clientSecret) return { kind: 'not_found' };
  throw new UpstreamError('fatsecret adapter is not implemented until phase 4 credentials exist');
}
