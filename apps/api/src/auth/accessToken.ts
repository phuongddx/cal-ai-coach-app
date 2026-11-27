import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
const ISSUER = 'coachcal-api';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

export async function signAccessToken(
  secret: Uint8Array,
  userId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: string }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expires = issuedAt + ACCESS_TTL_SECONDS;
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expires)
    .sign(secret);
  return { token, expiresAt: new Date(expires * 1000).toISOString() };
}

/** Undefined for anything that is not a valid, unexpired token signed by this API. */
export async function verifyAccessToken(secret: Uint8Array, token: string): Promise<AccessClaims | undefined> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: ISSUER });
    const sid = payload['sid'];
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) return undefined;
    if (typeof sid !== 'string' || !UUID.test(sid)) return undefined;
    return { userId: payload.sub, sessionId: sid };
  } catch {
    return undefined;
  }
}
