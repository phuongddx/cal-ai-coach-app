import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Free-tier quota — the edge-function side of the claim_scan_credit SECURITY
 * DEFINER RPC (02-01). The verdict is computed in Postgres keyed by auth.uid();
 * this module only interprets it and shapes the 402 body (RESEARCH Pattern 4).
 */

export interface ClaimVerdict {
  claimed: boolean;
  used: number;
  limit: number;
  resetAt?: string;
}

export async function claimScanCredit(
  userClient: SupabaseClient,
  scanId: string,
): Promise<ClaimVerdict> {
  const { data, error } = await userClient.rpc('claim_scan_credit', { p_scan_id: scanId });
  if (error) throw error;
  return {
    claimed: data?.claimed === true,
    used: Number(data?.used ?? 0),
    limit: Number(data?.limit ?? 0),
    resetAt: typeof data?.resetAt === 'string' ? data.resetAt : undefined,
  };
}

/** Body for the 402 response — carries the entitlement state per success criterion 5. */
export function freeLimitEnvelope(verdict: ClaimVerdict) {
  const fallbackResetAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    error: {
      code: 'FREE_LIMIT_REACHED',
      entitlement: {
        tier: 'free',
        scansUsed: verdict.used,
        scanLimit: verdict.limit,
        windowResetAt: verdict.resetAt ?? fallbackResetAt,
      },
    },
  };
}
