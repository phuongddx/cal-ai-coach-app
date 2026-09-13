/**
 * Stack env resolution for edge-function tests. Local `supabase status -o env`
 * emits API_URL/ANON_KEY/SERVICE_ROLE_KEY; hosted spellings are accepted as
 * fallbacks. Fails hard — naming the remedy — when the stack is not running.
 */

function requiredEnv(label: string, candidates: string[]): string {
  for (const name of candidates) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(
    `${label} is missing (looked for ${candidates.join(', ')}). ` +
      'Run `supabase status -o env` and pass the output via --env-file.',
  );
}

export interface StackEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function stackEnv(): StackEnv {
  return {
    url: requiredEnv('Supabase URL', ['API_URL', 'SUPABASE_URL']),
    anonKey: requiredEnv('Anon key', ['ANON_KEY', 'SUPABASE_ANON_KEY']),
    serviceRoleKey: requiredEnv('Service role key', [
      'SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]),
  };
}
