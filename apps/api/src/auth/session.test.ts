/**
 * E-mail code, e-mail + password, session lifecycle, rate limits and cross-user denial, through the
 * HTTP routes and the real SQL functions.
 */
import { SessionResponseSchema, type SessionResponse } from '@coachcal/api-contract';
import { SignJWT } from 'jose';

import { describeSql, TEST_JWT_SECRET, type Harness } from '../testing/sqlHarness';
import { hashPassword } from './crypto';
import { signAccessToken } from './accessToken';

let counter = 0;
/** Each request gets its own client address so the per-IP limits of one test never reach another. */
const ip = (): Record<string, string> => ({ 'x-forwarded-for': `10.${Math.floor(counter / 250) % 250}.${++counter % 250}.7` });
const email = (tag: string) => `${tag}-${crypto.randomUUID()}@example.test`;

const parse = async (res: Response): Promise<SessionResponse> => SessionResponseSchema.parse(await res.json());

async function expectError(res: Response, status: number, code: string): Promise<void> {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe(code);
}

async function signInByCode(h: Harness, address: string): Promise<SessionResponse> {
  expect((await h.post('/v1/auth/otp/request', { email: address }, undefined, ip())).status).toBe(200);
  const code = h.otp.lastCode(address.toLowerCase());
  expect(code).toMatch(/^\d{6}$/);
  const res = await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip());
  expect(res.status).toBe(200);
  const session = await parse(res);
  h.track(session.user.id, session.user.email ?? undefined);
  return session;
}

const sessionId = (refreshToken: string) => refreshToken.split('.')[0] ?? '';

describeSql('e-mail code sign-in', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  it('a code mailed to an address signs that address in and creates the user', async () => {
    const h = harness();
    const address = email('otp');
    const session = await signInByCode(h, address);
    expect(session.user.email).toBe(address);
    expect(session.user.providers).toEqual(['email']);
    const again = await signInByCode(h, address);
    expect(again.user.id).toBe(session.user.id);
  });

  it('addresses are matched case-insensitively and trimmed', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address.toUpperCase() }, undefined, ip());
    const code = h.otp.lastCode(address);
    const res = await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip());
    expect(res.status).toBe(200);
    h.track((await parse(res)).user.id, address);
  });

  it('the plain code is never stored: only its keyed hash', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    h.track(crypto.randomUUID(), address);
    const [row] = await h.owner<{ code_hash: string }[]>`SELECT code_hash FROM public.auth_otp_codes WHERE email = ${address}`;
    expect(row?.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.code_hash).not.toContain(h.otp.lastCode(address) ?? 'x');
  });

  it('a wrong code is rejected with 401 and the right code still works afterwards', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const code = h.otp.lastCode(address)!;
    const wrong = code === '000000' ? '111111' : '000000';
    await expectError(await h.post('/v1/auth/otp/verify', { email: address, code: wrong }, undefined, ip()), 401, 'UNAUTHORIZED');
    const ok = await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip());
    expect(ok.status).toBe(200);
    h.track((await parse(ok)).user.id, address);
  });

  it('a code for an address nobody asked about is rejected with 401', async () => {
    const h = harness();
    await expectError(await h.post('/v1/auth/otp/verify', { email: email('ghost'), code: '123456' }, undefined, ip()), 401, 'UNAUTHORIZED');
  });

  it('an expired code is rejected with 401', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    h.track(crypto.randomUUID(), address);
    await h.owner`UPDATE public.auth_otp_codes SET expires_at = now() - interval '1 second' WHERE email = ${address}`;
    await expectError(
      await h.post('/v1/auth/otp/verify', { email: address, code: h.otp.lastCode(address) }, undefined, ip()),
      401,
      'UNAUTHORIZED',
    );
  });

  it('five wrong attempts lock the code even for the right code', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const code = h.otp.lastCode(address)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await expectError(await h.post('/v1/auth/otp/verify', { email: address, code: wrong }, undefined, ip()), 401, 'UNAUTHORIZED');
    }
    await expectError(await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip()), 401, 'UNAUTHORIZED');
    // A new code resets the counter.
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const fresh = await h.post('/v1/auth/otp/verify', { email: address, code: h.otp.lastCode(address) }, undefined, ip());
    expect(fresh.status).toBe(200);
    h.track((await parse(fresh)).user.id, address);
  });

  it('a code that was already used cannot be used again', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const code = h.otp.lastCode(address)!;
    const first = await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip());
    expect(first.status).toBe(200);
    h.track((await parse(first)).user.id, address);
    await expectError(await h.post('/v1/auth/otp/verify', { email: address, code }, undefined, ip()), 401, 'UNAUTHORIZED');
  });

  it('a new request replaces the earlier code', async () => {
    const h = harness();
    const address = email('otp');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const first = h.otp.lastCode(address)!;
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    const second = h.otp.lastCode(address)!;
    if (first !== second) {
      await expectError(await h.post('/v1/auth/otp/verify', { email: address, code: first }, undefined, ip()), 401, 'UNAUTHORIZED');
    }
    const ok = await h.post('/v1/auth/otp/verify', { email: address, code: second }, undefined, ip());
    expect(ok.status).toBe(200);
    h.track((await parse(ok)).user.id, address);
  });

  it('answers 503 when the code cannot be delivered', async () => {
    const h = harness();
    const address = email('otp');
    h.track(crypto.randomUUID(), address);
    h.otp.failWith = new Error('smtp down');
    try {
      await expectError(await h.post('/v1/auth/otp/request', { email: address }, undefined, ip()), 503, 'UPSTREAM_ERROR');
    } finally {
      h.otp.failWith = undefined;
    }
  });

  it('malformed bodies answer 400', async () => {
    const h = harness();
    await expectError(await h.post('/v1/auth/otp/request', { email: 'nope' }, undefined, ip()), 400, 'VALIDATION_ERROR');
    await expectError(await h.post('/v1/auth/otp/verify', { email: email('x'), code: '12' }, undefined, ip()), 400, 'VALIDATION_ERROR');
    await expectError(await h.post('/v1/auth/otp/verify', '{', undefined, ip()), 400, 'VALIDATION_ERROR');
  });
});

describeSql('e-mail and password sign-in', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  async function userWithPassword(h: Harness, password: string) {
    const user = await h.sessionUser();
    await h.owner`UPDATE public.users SET password_hash = ${await hashPassword(password)} WHERE id = ${user.userId}::uuid`;
    return user;
  }

  it('the right password signs an existing user in', async () => {
    const h = harness();
    const user = await userWithPassword(h, 'correct horse battery');
    const res = await h.post('/v1/auth/email', { email: user.email, password: 'correct horse battery' }, undefined, ip());
    expect(res.status).toBe(200);
    expect((await parse(res)).user.id).toBe(user.userId);
  });

  it('a wrong password, an unknown user and a user without a password all answer the same 401', async () => {
    const h = harness();
    const user = await userWithPassword(h, 'correct horse battery');
    const noPassword = await h.sessionUser();
    const attempts = [
      { email: user.email, password: 'wrong password!' },
      { email: email('ghost'), password: 'correct horse battery' },
      { email: noPassword.email, password: 'correct horse battery' },
    ];
    const bodies: string[] = [];
    for (const attempt of attempts) {
      const res = await h.post('/v1/auth/email', attempt, undefined, ip());
      expect(res.status).toBe(401);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it('never creates a user', async () => {
    const h = harness();
    const address = email('ghost');
    await h.post('/v1/auth/email', { email: address, password: 'whatever password' }, undefined, ip());
    const [row] = await h.owner<{ n: number }[]>`SELECT count(*)::int AS n FROM public.users WHERE email = ${address}`;
    expect(row?.n).toBe(0);
  });

  it('stores the password as a salted scrypt hash', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^scrypt\$/);
    expect(stored).not.toContain('correct horse battery');
    expect(await hashPassword('correct horse battery')).not.toBe(stored);
  });
});

describeSql('sessions', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  const protectedCall = (h: Harness, token: string) => h.post('/v1/sync/pull', { cursor: 0 }, token);

  it('a session opens protected routes until it is signed out', async () => {
    const h = harness();
    const user = await h.sessionUser();
    expect((await protectedCall(h, user.accessToken)).status).toBe(200);
    expect((await h.post('/v1/auth/signout', {}, user.accessToken)).status).toBe(200);
    await expectError(await protectedCall(h, user.accessToken), 401, 'UNAUTHORIZED');
    await expectError(await h.post('/v1/auth/refresh', { refreshToken: user.refreshToken }), 401, 'UNAUTHORIZED');
  });

  it('a request without a token, or with a garbage token, is 401', async () => {
    const h = harness();
    await expectError(await h.post('/v1/sync/pull', { cursor: 0 }), 401, 'UNAUTHORIZED');
    await expectError(await protectedCall(h, 'garbage'), 401, 'UNAUTHORIZED');
    await expectError(await protectedCall(h, 'a.b.c'), 401, 'UNAUTHORIZED');
  });

  it('a token with the wrong signature, wrong issuer or no session is rejected', async () => {
    const h = harness();
    const user = await h.sessionUser();
    const sid = sessionId(user.refreshToken);
    const forge = (secret: string, issuer: string, sub = user.userId, session: string | undefined = sid) =>
      new SignJWT(session ? { sid: session } : {})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(new TextEncoder().encode(secret));
    await expectError(await protectedCall(h, await forge('another-secret-0123456789-0123456789', 'coachcal-api')), 401, 'UNAUTHORIZED');
    await expectError(await protectedCall(h, await forge(TEST_JWT_SECRET, 'someone-else')), 401, 'UNAUTHORIZED');
    await expectError(await protectedCall(h, await forge(TEST_JWT_SECRET, 'coachcal-api', user.userId, '')), 401, 'UNAUTHORIZED');
    // Valid signature, but the session belongs to another user.
    const other = await h.sessionUser();
    await expectError(await protectedCall(h, await forge(TEST_JWT_SECRET, 'coachcal-api', other.userId)), 401, 'UNAUTHORIZED');
    // Sanity: the same forge with the right inputs is accepted.
    expect((await protectedCall(h, await forge(TEST_JWT_SECRET, 'coachcal-api'))).status).toBe(200);
  });

  it('an expired access token is rejected', async () => {
    const h = harness();
    const user = await h.sessionUser();
    const { token } = await signAccessToken(h.config.jwtSecret, user.userId, sessionId(user.refreshToken), new Date(Date.now() - 3600_000));
    await expectError(await protectedCall(h, token), 401, 'UNAUTHORIZED');
  });

  it('a session whose row expired or was revoked is rejected even with a valid token', async () => {
    const h = harness();
    const expired = await h.sessionUser();
    await h.owner`UPDATE public.auth_sessions SET expires_at = now() - interval '1 second' WHERE id = ${sessionId(expired.refreshToken)}::uuid`;
    await expectError(await protectedCall(h, expired.accessToken), 401, 'UNAUTHORIZED');
    await expectError(await h.post('/v1/auth/refresh', { refreshToken: expired.refreshToken }), 401, 'UNAUTHORIZED');

    const revoked = await h.sessionUser();
    await h.owner`UPDATE public.auth_sessions SET revoked_at = now() WHERE id = ${sessionId(revoked.refreshToken)}::uuid`;
    await expectError(await protectedCall(h, revoked.accessToken), 401, 'UNAUTHORIZED');
  });

  it('refresh rotates the refresh token and the old one is rejected', async () => {
    const h = harness();
    const user = await h.sessionUser();
    const res = await h.post('/v1/auth/refresh', { refreshToken: user.refreshToken });
    expect(res.status).toBe(200);
    const next = await parse(res);
    expect(next.user.id).toBe(user.userId);
    expect(next.tokens.refreshToken).not.toBe(user.refreshToken);
    expect(sessionId(next.tokens.refreshToken)).toBe(sessionId(user.refreshToken));
    expect((await protectedCall(h, next.tokens.accessToken)).status).toBe(200);
    await expectError(await h.post('/v1/auth/refresh', { refreshToken: user.refreshToken }), 401, 'UNAUTHORIZED');
  });

  it('presenting an already rotated refresh token revokes the whole session', async () => {
    const h = harness();
    const user = await h.sessionUser();
    const next = await parse(await h.post('/v1/auth/refresh', { refreshToken: user.refreshToken }));
    // The thief replays the old token ...
    await expectError(await h.post('/v1/auth/refresh', { refreshToken: user.refreshToken }), 401, 'UNAUTHORIZED');
    // ... and now neither the new refresh token nor the access token works.
    await expectError(await h.post('/v1/auth/refresh', { refreshToken: next.tokens.refreshToken }), 401, 'UNAUTHORIZED');
    await expectError(await protectedCall(h, next.tokens.accessToken), 401, 'UNAUTHORIZED');
  });

  it('malformed or foreign refresh tokens are rejected', async () => {
    const h = harness();
    const user = await h.sessionUser();
    for (const refreshToken of ['nodot', '.x', `${crypto.randomUUID()}.abc`, `${sessionId(user.refreshToken)}.wrong`, 'not-a-uuid.abc']) {
      await expectError(await h.post('/v1/auth/refresh', { refreshToken }), 401, 'UNAUTHORIZED');
    }
    // A wrong secret for a live session is not treated as reuse: the session survives.
    expect((await protectedCall(h, user.accessToken)).status).toBe(200);
  });

  it('only the hash of the refresh secret is stored', async () => {
    const h = harness();
    const user = await h.sessionUser();
    const secret = user.refreshToken.split('.')[1] ?? '';
    const [row] = await h.owner<{ refresh_hash: string }[]>`SELECT refresh_hash FROM public.auth_sessions WHERE id = ${sessionId(user.refreshToken)}::uuid`;
    expect(row?.refresh_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.refresh_hash).not.toContain(secret);
  });

  it('signing out ends only that session, not the same user\'s other devices', async () => {
    const h = harness();
    const first = await h.sessionUser();
    const second = await h.sessions.issue({ id: first.userId, email: first.email.toLowerCase(), providers: [] });
    expect(sessionId(second.tokens.refreshToken)).not.toBe(sessionId(first.refreshToken));
    expect((await h.post('/v1/auth/signout', {}, first.accessToken)).status).toBe(200);
    await expectError(await protectedCall(h, first.accessToken), 401, 'UNAUTHORIZED');
    expect((await protectedCall(h, second.tokens.accessToken)).status).toBe(200);
  });

  it('dev tokens are rejected unless AUTH_DEV_TOKENS is 1', async () => {
    const h = harness();
    const dev = await h.newUser();
    expect((await protectedCall(h, dev.token)).status).toBe(200);
    const saved = process.env.AUTH_DEV_TOKENS;
    process.env.AUTH_DEV_TOKENS = '0';
    try {
      await expectError(await protectedCall(h, dev.token), 401, 'UNAUTHORIZED');
    } finally {
      process.env.AUTH_DEV_TOKENS = saved;
    }
  });
});

describeSql('rate limits', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  it('the sixth code request for one address within an hour is 429 with Retry-After', async () => {
    const h = harness();
    const address = email('limit');
    h.track(crypto.randomUUID(), address);
    for (let i = 0; i < 5; i += 1) {
      expect((await h.post('/v1/auth/otp/request', { email: address }, undefined, ip())).status).toBe(200);
    }
    const blocked = await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    await expectError(blocked, 429, 'VALIDATION_ERROR');
    expect(blocked.headers.get('retry-after')).toBe('900');
    // Another address from another client is not affected.
    const other = email('limit');
    h.track(crypto.randomUUID(), other);
    expect((await h.post('/v1/auth/otp/request', { email: other }, undefined, ip())).status).toBe(200);
  });

  it('one client address cannot request codes for more than twenty addresses an hour', async () => {
    const h = harness();
    const fixed = { 'x-forwarded-for': '172.16.0.99' };
    for (let i = 0; i < 20; i += 1) {
      const address = email('flood');
      h.track(crypto.randomUUID(), address);
      expect((await h.post('/v1/auth/otp/request', { email: address }, undefined, fixed)).status).toBe(200);
    }
    await expectError(await h.post('/v1/auth/otp/request', { email: email('flood') }, undefined, fixed), 429, 'VALIDATION_ERROR');
  });

  it('only the last X-Forwarded-For entry counts, so a client cannot dodge the limit by forging earlier ones', async () => {
    const h = harness();
    const proxyAppended = '172.16.1.50';
    for (let i = 0; i < 20; i += 1) {
      const address = email('forge');
      h.track(crypto.randomUUID(), address);
      await h.post('/v1/auth/otp/request', { email: address }, undefined, { 'x-forwarded-for': `1.2.3.${i}, ${proxyAppended}` });
    }
    await expectError(
      await h.post('/v1/auth/otp/request', { email: email('forge') }, undefined, { 'x-forwarded-for': `9.9.9.9, ${proxyAppended}` }),
      429,
      'VALIDATION_ERROR',
    );
  });

  it('the eleventh code check for one address within fifteen minutes is 429', async () => {
    const h = harness();
    const address = email('verify');
    await h.post('/v1/auth/otp/request', { email: address }, undefined, ip());
    h.track(crypto.randomUUID(), address);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await h.post('/v1/auth/otp/verify', { email: address, code: '000000' }, undefined, ip())).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('the eleventh password attempt for one address within fifteen minutes is 429', async () => {
    const h = harness();
    const address = email('pw');
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await h.post('/v1/auth/email', { email: address, password: 'wrong password!' }, undefined, ip())).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
