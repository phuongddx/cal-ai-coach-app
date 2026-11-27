import { ConfigError, loadConfig } from './config';

const base = {
  DATABASE_URL: 'postgres://u:pw-in-url@h/db',
  AUTH_JWT_SECRET: 'j'.repeat(40),
  AUTH_ENCRYPTION_KEY: 'e'.repeat(40),
  RC_WEBHOOK_SIGNING_SECRET: 'whsec-test',
  OTP_SENDER: 'log',
};

describe('startup configuration', () => {
  it('accepts a complete minimal environment with the social providers unconfigured', () => {
    const config = loadConfig({ ...base });
    expect(config.otp.sender).toBe('log');
    expect(config.apple.configured).toBe(false);
    expect(config.google.configured).toBe(false);
    expect(config.devTokens).toBe(false);
  });

  it.each(['DATABASE_URL', 'AUTH_JWT_SECRET', 'AUTH_ENCRYPTION_KEY', 'RC_WEBHOOK_SIGNING_SECRET', 'OTP_SENDER'])(
    'a missing %s is a startup error that names the variable',
    (name) => {
      const env: Record<string, string | undefined> = { ...base };
      delete env[name];
      expect(() => loadConfig(env)).toThrow(ConfigError);
      expect(() => loadConfig(env)).toThrow(name);
    },
  );

  it('rejects short secrets without echoing them', () => {
    try {
      loadConfig({ ...base, AUTH_JWT_SECRET: 'tooshort' });
      throw new Error('expected a ConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain('AUTH_JWT_SECRET');
      expect((error as Error).message).not.toContain('tooshort');
    }
  });

  it('requires the mail variables when OTP_SENDER is resend and rejects unknown senders', () => {
    expect(() => loadConfig({ ...base, OTP_SENDER: 'resend' })).toThrow('RESEND_API_KEY');
    expect(() => loadConfig({ ...base, OTP_SENDER: 'resend', RESEND_API_KEY: 'k' })).toThrow('OTP_FROM');
    expect(loadConfig({ ...base, OTP_SENDER: 'resend', RESEND_API_KEY: 'k', OTP_FROM: 'a@b.c' }).otp.sender).toBe('resend');
    expect(() => loadConfig({ ...base, OTP_SENDER: 'smtp' })).toThrow('OTP_SENDER');
  });

  it('reports a provider with missing variables as unconfigured and names the missing ones', () => {
    const apple = loadConfig({ ...base, APPLE_BUNDLE_ID: 'com.example.app' }).apple;
    expect(apple.configured).toBe(false);
    expect(apple.missing).toEqual(['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY_PATH']);
    const google = loadConfig({ ...base, GOOGLE_CLIENT_ID: 'id' }).google;
    expect(google.configured).toBe(false);
    expect(google.missing).toEqual(['GOOGLE_CLIENT_SECRET', 'PUBLIC_BASE_URL']);
  });

  it('turns the dev tokens on only for AUTH_DEV_TOKENS=1', () => {
    expect(loadConfig({ ...base, AUTH_DEV_TOKENS: '1' }).devTokens).toBe(true);
    expect(loadConfig({ ...base, AUTH_DEV_TOKENS: 'true' }).devTokens).toBe(false);
  });
});
