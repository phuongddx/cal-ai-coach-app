/**
 * Entitlement reader (AD-01 resolution order): the caller resolves to an entitlement
 * through the legacy user-mapping column of the entitlements table, then the raw-uuid app_user_id fallback
 * (both inside the get_entitlement function). An active entitlement bypasses the quota
 * claim entirely: quota is a free-tier-only concept.
 */
import type { Query } from './db';

export interface EntitlementState {
  tier: 'free' | 'premium';
  active: boolean;
  expiresAt: string | null;
}

interface EntitlementRow {
  state: { active?: unknown; expiresAt?: unknown } | null;
}

/** Must run inside `withUser`: the function reads the caller from app.user_id. */
export async function getEntitlementState(query: Query): Promise<EntitlementState> {
  const [row] = await query<EntitlementRow>('SELECT public.get_entitlement() AS state');
  // active=true alone is not access: the function already drops rows whose
  // expires_at is in the past (e.g. a lagging EXPIRATION webhook).
  if (row?.state?.active !== true) return { tier: 'free', active: false, expiresAt: null };
  const expiresAt = row.state.expiresAt;
  return { tier: 'premium', active: true, expiresAt: typeof expiresAt === 'string' ? expiresAt : null };
}
