import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Entitlement reader (AD-01 resolution order): resolve a Supabase auth user to
 * an entitlement via the supabase_user_id mapping column, then the raw-uuid
 * app_user_id fallback. An active entitlement bypasses the quota claim
 * entirely — quota is a free-tier-only concept.
 */

export interface EntitlementState {
  tier: 'free' | 'premium';
  active: boolean;
  expiresAt: string | null;
}

export async function getEntitlementState(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<EntitlementState> {
  const { data, error } = await serviceClient
    .from('entitlements')
    .select('entitlement_id, expires_at')
    .or(`supabase_user_id.eq.${userId},app_user_id.eq.${userId}`)
    .eq('active', true)
    .order('expires_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  // active=true alone is not access: an expires_at in the past is expired
  // (e.g. a lagging EXPIRATION webhook), so unexpired rows are filtered here.
  const now = Date.now();
  const current = (data ?? []).find(
    (row) => row.expires_at === null || new Date(row.expires_at).getTime() > now,
  );
  if (!current) return { tier: 'free', active: false, expiresAt: null };
  return { tier: 'premium', active: true, expiresAt: current.expires_at };
}
