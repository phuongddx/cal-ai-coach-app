/**
 * Free-tier quota: the API side of the claim_scan_credit SECURITY DEFINER function.
 * The verdict is computed in Postgres keyed by the app.user_id setting; this module
 * only interprets it and shapes the 402 body (ported from _shared/quota.ts).
 */
import type { Query } from './db';

export interface ClaimVerdict {
  claimed: boolean;
  used: number;
  limit: number;
  resetAt?: string;
}

interface ClaimRow {
  verdict: { claimed?: unknown; used?: unknown; limit?: unknown; resetAt?: unknown } | null;
}

/** Must run inside `withUser`: the function derives the owner from app.user_id. */
export async function claimScanCredit(query: Query, scanId: string): Promise<ClaimVerdict> {
  const [row] = await query<ClaimRow>('SELECT public.claim_scan_credit($1::uuid) AS verdict', [scanId]);
  const data = row?.verdict;
  return {
    claimed: data?.claimed === true,
    used: Number(data?.used ?? 0),
    limit: Number(data?.limit ?? 0),
    resetAt: typeof data?.resetAt === 'string' ? data.resetAt : undefined,
  };
}

/** Body for the 402 response: carries the entitlement state. */
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
