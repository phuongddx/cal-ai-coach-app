/** Builds the running app from the validated configuration (real providers, real mail sender). */
import { readFileSync } from 'node:fs';

import postgres from 'postgres';

import { createApp } from './app';
import { LogOtpSender, ResendOtpSender, type OtpSender } from './auth/otpSender';
import { AppleProvider } from './auth/providers/apple';
import { GoogleProvider } from './auth/providers/google';
import { createAuthLimits } from './auth/routes';
import { deriveKey } from './auth/crypto';
import { SessionService } from './auth/session';
import { ConfigError, type Config } from './config';
import { createDb, type Db } from './db';
import { migrate } from './migrate';

export interface Running {
  app: ReturnType<typeof createApp>;
  db: Db;
  /** Stops the limiter sweep; the caller closes the database. */
  stopTimers(): void;
}

function readPrivateKey(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new ConfigError('APPLE_PRIVATE_KEY_PATH is set but the file cannot be read');
  }
}

export function buildOtpSender(config: Config): OtpSender {
  return config.otp.sender === 'resend'
    ? new ResendOtpSender({ apiKey: config.otp.resendApiKey, from: config.otp.from })
    : new LogOtpSender();
}

/** Runs the migrations as the owner role; used by `npm start` when RUN_MIGRATIONS_ON_START=1. */
export async function runStartupMigrations(config: Config): Promise<string[]> {
  if (!config.ownerDatabaseUrl) {
    throw new ConfigError('RUN_MIGRATIONS_ON_START=1 needs OWNER_DATABASE_URL (the coachcal_owner connection)');
  }
  const sql = postgres(config.ownerDatabaseUrl, { max: 1, onnotice: () => undefined });
  try {
    return await migrate(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export function buildRunning(config: Config): Running {
  const db = createDb(config.databaseUrl);
  const sessions = new SessionService({ db, jwtSecret: config.jwtSecret });
  const apple = config.apple.configured
    ? new AppleProvider({ config: config.apple, privateKeyPem: readPrivateKey(config.apple.privateKeyPath) })
    : undefined;
  const google = config.google.configured
    ? new GoogleProvider({ config: config.google, stateSecret: deriveKey(config.encryptionSecret, 'google-state') })
    : undefined;
  const limits = createAuthLimits();
  const sweep = setInterval(() => {
    for (const limiter of Object.values(limits)) limiter.sweep();
  }, 10 * 60 * 1000);
  sweep.unref();

  const app = createApp({
    auth: { db, sessions, config, otpSender: buildOtpSender(config), apple, google, limits },
    webhookSecret: config.webhookSecret,
  });
  return { app, db, stopTimers: () => clearInterval(sweep) };
}
