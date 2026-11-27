import {
  AppleSignInRequestSchema,
  EmailSignInRequestSchema,
  GoogleExchangeRequestSchema,
  OkSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshRequestSchema,
  SessionResponseSchema,
} from './auth';

describe('auth wire contracts', () => {
  const session = {
    user: { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co', providers: ['apple'] },
    tokens: { accessToken: 'a.b.c', refreshToken: 'r'.repeat(43), expiresAt: '2026-11-27T04:15:00.000Z' },
  };

  it('accepts a session response and rejects an unknown key', () => {
    expect(SessionResponseSchema.parse(session).user.providers).toEqual(['apple']);
    expect(SessionResponseSchema.safeParse({ ...session, deviceId: 'x' }).success).toBe(false);
  });

  it('requires a uuid as the user id and a known provider', () => {
    expect(SessionResponseSchema.safeParse({ ...session, user: { ...session.user, id: '1' } }).success).toBe(false);
    expect(SessionResponseSchema.safeParse({ ...session, user: { ...session.user, providers: ['facebook'] } }).success).toBe(false);
  });

  it('the Apple request needs the identity token and the nonce, the authorization code is optional', () => {
    expect(AppleSignInRequestSchema.safeParse({ identityToken: 't', nonce: 'n' }).success).toBe(true);
    expect(AppleSignInRequestSchema.safeParse({ identityToken: 't' }).success).toBe(false);
    expect(AppleSignInRequestSchema.safeParse({ nonce: 'n' }).success).toBe(false);
  });

  it('the one-time Google code is exchanged with a single field', () => {
    expect(GoogleExchangeRequestSchema.safeParse({ code: 'c' }).success).toBe(true);
    expect(GoogleExchangeRequestSchema.safeParse({ code: 'c', state: 's' }).success).toBe(false);
  });

  it('an email sign-in needs an email and a password of 8 to 200 characters', () => {
    expect(EmailSignInRequestSchema.safeParse({ email: 'a@b.co', password: 'longEnough1' }).success).toBe(true);
    expect(EmailSignInRequestSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(EmailSignInRequestSchema.safeParse({ email: 'not-an-email', password: 'longEnough1' }).success).toBe(false);
  });

  it('a one-time code is six digits', () => {
    expect(OtpRequestSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(OtpVerifySchema.safeParse({ email: 'a@b.co', code: '123456' }).success).toBe(true);
    expect(OtpVerifySchema.safeParse({ email: 'a@b.co', code: '12345' }).success).toBe(false);
    expect(OtpVerifySchema.safeParse({ email: 'a@b.co', code: 'abcdef' }).success).toBe(false);
  });

  it('a refresh needs the refresh token and the ok answer is literally true', () => {
    expect(RefreshRequestSchema.safeParse({ refreshToken: 'r' }).success).toBe(true);
    expect(RefreshRequestSchema.safeParse({ accessToken: 'a' }).success).toBe(false);
    expect(OkSchema.safeParse({ ok: true }).success).toBe(true);
    expect(OkSchema.safeParse({ ok: false }).success).toBe(false);
    expect(OkSchema.safeParse({ ok: true, extra: 1 }).success).toBe(false);
  });
});
