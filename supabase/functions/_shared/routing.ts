import type { VlmOutput } from './contracts/vlm.ts';
import type { VlmTier } from './vlm/provider.ts';

/**
 * Two-tier escalation routing — the only escalation policy in the pipeline.
 * A Tier-1 output re-runs once at Tier-2 when the scan or any item sits
 * below the confidence floors; the Tier-2 output is authoritative. Phase 4
 * maps tiers to real models config-only.
 */

export const TIER1_MIN_SCAN_CONFIDENCE = 0.7;
export const TIER1_MIN_ITEM_CONFIDENCE = 0.5;

export function chooseTier(output: VlmOutput): VlmTier {
  if (output.scanConfidence < TIER1_MIN_SCAN_CONFIDENCE) return 'tier2';
  if (output.items.some((item) => item.confidence < TIER1_MIN_ITEM_CONFIDENCE)) return 'tier2';
  return 'tier1';
}
