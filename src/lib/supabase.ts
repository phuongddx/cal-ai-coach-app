import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getPublicEnv } from './env';

/**
 * Public-key-only Supabase client (Plan 01-04 Task 2 / T-01-20).
 * Credentials come exclusively from src/lib/env.ts (validated EXPO_PUBLIC_*
 * values, publishable key only). Service-role credentials must never exist on
 * device — this module is the single client seam so that stays enforceable.
 *
 * Phase 1 scope: transient stub sessions, so session persistence stays off;
 * encrypted session storage (SecureStore/AsyncStorage) arrives with real auth.
 */

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  const env = getPublicEnv();
  cached = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
