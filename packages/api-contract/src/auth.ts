import { z } from 'zod';

/**
 * Sign-in and session wire contracts — the ONLY shapes crossing the client ↔ /v1/auth and
 * /v1/account boundary. Supabase GoTrue did this before; the Hono API does it now. All object
 * schemas are strict: unknown keys are rejected at the boundary. Bodies that fail a schema answer
 * 400 VALIDATION_ERROR; a wrong credential answers 401 UNAUTHORIZED; a provider the server is not
 * configured for answers 503 UPSTREAM_ERROR. Every error uses the uniform error envelope.
 *
 * Endpoints and bodies:
 *   POST   /v1/auth/apple            AppleSignInRequestSchema      -> SessionResponseSchema
 *   GET    /v1/auth/google/start     (browser redirect to Google)
 *   GET    /v1/auth/google/callback  (browser redirect to coachcal://auth/google?code=<one-time code>)
 *   POST   /v1/auth/google/exchange  GoogleExchangeRequestSchema   -> SessionResponseSchema
 *   POST   /v1/auth/email            EmailSignInRequestSchema      -> SessionResponseSchema (existing users only)
 *   POST   /v1/auth/otp/request      OtpRequestSchema              -> OkSchema
 *   POST   /v1/auth/otp/verify       OtpVerifySchema               -> SessionResponseSchema (creates the user when missing)
 *   POST   /v1/auth/refresh          RefreshRequestSchema          -> SessionResponseSchema (refresh token rotates)
 *   POST   /v1/auth/signout          bearer access token           -> OkSchema
 *   DELETE /v1/account               bearer access token           -> OkSchema
 * Tokens never travel in a URL: the Google callback carries a one-time code that is exchanged once.
 * The client treats accessToken and refreshToken as opaque strings.
 */

export const authProviderSchema = z.enum(['apple', 'google', 'email']);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const SessionUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.string().nullable(),
  /** Every sign-in method linked to this account. */
  providers: z.array(authProviderSchema),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const SessionTokensSchema = z.strictObject({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** ISO-8601 instant when the access token stops being accepted. */
  expiresAt: z.iso.datetime(),
});
export type SessionTokens = z.infer<typeof SessionTokensSchema>;

export const SessionResponseSchema = z.strictObject({
  user: SessionUserSchema,
  tokens: SessionTokensSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const AppleSignInRequestSchema = z.strictObject({
  identityToken: z.string().min(1),
  /** The raw nonce that was hashed into the Apple request; the server hashes it again and compares. */
  nonce: z.string().min(1),
  /** Present on the first sign-in; the server exchanges it for the token it revokes on account deletion. */
  authorizationCode: z.string().min(1).optional(),
  givenName: z.string().max(200).optional(),
  familyName: z.string().max(200).optional(),
});
export type AppleSignInRequest = z.infer<typeof AppleSignInRequestSchema>;

export const GoogleExchangeRequestSchema = z.strictObject({
  code: z.string().min(1),
});
export type GoogleExchangeRequest = z.infer<typeof GoogleExchangeRequestSchema>;

export const EmailSignInRequestSchema = z.strictObject({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type EmailSignInRequest = z.infer<typeof EmailSignInRequestSchema>;

export const OtpRequestSchema = z.strictObject({
  email: z.string().email(),
});
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = z.strictObject({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'code is six digits'),
});
export type OtpVerifyRequest = z.infer<typeof OtpVerifySchema>;

export const RefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const OkSchema = z.strictObject({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkSchema>;
