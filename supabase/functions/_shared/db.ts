import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Supabase client seam for edge functions — mirrors src/lib/supabase.ts.
 * getUserClient carries the CALLER's Authorization bearer, so it is built per
 * request and never cached; only the service client is a cached singleton.
 * Env names fall back across local (`supabase status -o env`) and hosted
 * (platform-injected) spellings.
 */

function envValue(...candidates: string[]): string | undefined {
  for (const name of candidates) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return undefined;
}

function baseUrl(): string {
  return envValue('API_URL', 'SUPABASE_URL') ?? 'http://127.0.0.1:54321';
}

function anonKey(): string {
  const key = envValue('ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!key) throw new Error('ANON_KEY/SUPABASE_ANON_KEY must be configured');
  return key;
}

export function getServiceClient(): SupabaseClient {
  const cached = serviceClient;
  if (cached) return cached;
  const serviceKey = envValue('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY');
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY must be configured');
  }
  serviceClient = createClient(baseUrl(), serviceKey, { auth: { persistSession: false } });
  return serviceClient;
}

export function getUserClient(req: Request): SupabaseClient {
  return createClient(baseUrl(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

let serviceClient: SupabaseClient | null = null;
