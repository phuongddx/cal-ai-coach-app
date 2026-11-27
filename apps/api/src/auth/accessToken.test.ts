import { SignJWT } from 'jose';

import { ACCESS_TTL_SECONDS, signAccessToken, verifyAccessToken } from './accessToken';

const SECRET = Buffer.from('s'.repeat(48));
const USER = '11111111-1111-4111-8111-111111111111';
const SID = '99999999-9999-4999-8999-999999999999';

describe('access token (HS256, 15 minutes, sub and sid)', () => {
  it('signs and verifies a token carrying the user and the session', async () => {
    const { token, expiresAt } = await signAccessToken(SECRET, USER, SID);
    expect(await verifyAccessToken(SECRET, token)).toEqual({ userId: USER, sessionId: SID });
    const lifetimeMs = new Date(expiresAt).getTime() - Date.now();
    expect(lifetimeMs).toBeGreaterThan((ACCESS_TTL_SECONDS - 5) * 1000);
    expect(lifetimeMs).toBeLessThanOrEqual(ACCESS_TTL_SECONDS * 1000);
  });

  it('rejects a token signed with another secret', async () => {
    const { token } = await signAccessToken(Buffer.from('x'.repeat(48)), USER, SID);
    expect(await verifyAccessToken(SECRET, token)).toBeUndefined();
  });

  it('rejects an expired token', async () => {
    const { token } = await signAccessToken(SECRET, USER, SID, new Date(Date.now() - 3600_000));
    expect(await verifyAccessToken(SECRET, token)).toBeUndefined();
  });

  it('rejects a token without sid, with a non-uuid subject or with another algorithm', async () => {
    const noSid = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER)
      .setIssuer('coachcal-api')
      .setExpirationTime('15m')
      .sign(SECRET);
    expect(await verifyAccessToken(SECRET, noSid)).toBeUndefined();

    const badSub = await new SignJWT({ sid: SID })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('not-a-uuid')
      .setIssuer('coachcal-api')
      .setExpirationTime('15m')
      .sign(SECRET);
    expect(await verifyAccessToken(SECRET, badSub)).toBeUndefined();

    const hs512 = await new SignJWT({ sid: SID })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(USER)
      .setIssuer('coachcal-api')
      .setExpirationTime('15m')
      .sign(SECRET);
    expect(await verifyAccessToken(SECRET, hs512)).toBeUndefined();
  });

  it('rejects garbage and the unsigned alg=none form', async () => {
    expect(await verifyAccessToken(SECRET, 'garbage')).toBeUndefined();
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: USER, sid: SID, iss: 'coachcal-api', exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString('base64url')}.`;
    expect(await verifyAccessToken(SECRET, none)).toBeUndefined();
  });
});
