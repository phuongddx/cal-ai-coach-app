import { z } from 'zod';

/**
 * Public runtime configuration boundary.
 * ONLY EXPO_PUBLIC_* values may appear here. A service-role key, AI key, or any
 * server credential must never be added to this module or to Expo public config.
 */

const publicEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .refine(
      (value) => !/^sb_secret_/i.test(value) && !/service_role/i.test(value),
      'Refusing service-role or secret Supabase credentials in client config'
    ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

/** Validates and returns public env; throws with a precise message when unset/malformed. */
export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid public runtime configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (publishable key only).`
    );
  }
  cached = parsed.data;
  return cached;
}

/** True when public env is present and valid — used by gating UI, never bypasses validation. */
export function hasPublicEnv(): boolean {
  try {
    getPublicEnv();
    return true;
  } catch {
    return false;
  }
}
