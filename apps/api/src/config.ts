export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface ProviderConfig {
  configured: boolean;
  /** Names (never values) of the variables that are still unset. */
  missing: string[];
}

export interface AppleConfig extends ProviderConfig {
  bundleId: string;
  teamId: string;
  keyId: string;
  privateKeyPath: string;
}

export interface GoogleConfig extends ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface Config {
  databaseUrl: string;
  ownerDatabaseUrl: string | undefined;
  jwtSecret: Buffer;
  encryptionSecret: string;
  webhookSecret: Buffer;
  devTokens: boolean;
  otp: { sender: 'log' | 'resend'; resendApiKey: string; from: string };
  apple: AppleConfig;
  google: GoogleConfig;
  publicBaseUrl: string;
  port: number;
  host: string;
  runMigrationsOnStart: boolean;
}

type Env = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ConfigError(`${name} is required`);
  return value;
}

function secret(env: Env, name: string): string {
  const value = required(env, name);
  if (value.length < MIN_SECRET_LENGTH) throw new ConfigError(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  return value;
}

function provider(env: Env, names: string[]): { values: string[]; missing: string[] } {
  const values = names.map((name) => env[name]?.trim() ?? '');
  return { values, missing: names.filter((_, i) => !values[i]) };
}

/**
 * Reads and validates the process environment once at startup. Anything the API cannot run
 * without is a ConfigError (the process exits); the Apple and Google providers are optional and
 * answer 503 UPSTREAM_ERROR per request while their variables are missing.
 */
export function loadConfig(env: Env = process.env): Config {
  const databaseUrl = required(env, 'DATABASE_URL');
  const jwtSecret = secret(env, 'AUTH_JWT_SECRET');
  const encryptionSecret = secret(env, 'AUTH_ENCRYPTION_KEY');
  const webhookSecret = required(env, 'RC_WEBHOOK_SIGNING_SECRET');

  const senderRaw = required(env, 'OTP_SENDER');
  if (senderRaw !== 'log' && senderRaw !== 'resend') throw new ConfigError('OTP_SENDER must be log or resend');
  let resendApiKey = '';
  let from = '';
  if (senderRaw === 'resend') {
    resendApiKey = required(env, 'RESEND_API_KEY');
    from = required(env, 'OTP_FROM');
  }

  const publicBaseUrl = (env['PUBLIC_BASE_URL']?.trim() ?? '').replace(/\/+$/, '');

  const appleVars = provider(env, ['APPLE_BUNDLE_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY_PATH']);
  const googleVars = provider(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'PUBLIC_BASE_URL']);

  const port = Number(env['PORT'] ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError('PORT must be a port number');

  return {
    databaseUrl,
    ownerDatabaseUrl: env['OWNER_DATABASE_URL']?.trim() || undefined,
    jwtSecret: Buffer.from(jwtSecret, 'utf8'),
    encryptionSecret,
    webhookSecret: Buffer.from(webhookSecret, 'utf8'),
    devTokens: env['AUTH_DEV_TOKENS'] === '1',
    otp: { sender: senderRaw, resendApiKey, from },
    apple: {
      configured: appleVars.missing.length === 0,
      missing: appleVars.missing,
      bundleId: appleVars.values[0]!,
      teamId: appleVars.values[1]!,
      keyId: appleVars.values[2]!,
      privateKeyPath: appleVars.values[3]!,
    },
    google: {
      configured: googleVars.missing.length === 0,
      missing: googleVars.missing,
      clientId: googleVars.values[0]!,
      clientSecret: googleVars.values[1]!,
      redirectUri: `${publicBaseUrl}/v1/auth/google/callback`,
    },
    publicBaseUrl,
    port,
    host: env['HOST']?.trim() || '127.0.0.1',
    runMigrationsOnStart: env['RUN_MIGRATIONS_ON_START'] === '1',
  };
}
