/**
 * Sign-in providers end to end through the HTTP routes and the real SQL functions. Apple and Google
 * are never called: both providers get a stub `fetch` and a local key set, so the cases cover the
 * verification rules (signature, audience, issuer, expiry, nonce) with real RSA signatures.
 */
import { SessionResponseSchema, type SessionResponse } from '@coachcal/api-contract';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  type JWK,
} from 'jose';

import type { AppleConfig, GoogleConfig } from '../config';
import { describeSql, TEST_ENCRYPTION_KEY, type Harness } from '../testing/sqlHarness';
import { decryptSecret, deriveKey, sha256Hex } from './crypto';
import { AppleProvider, APPLE_ISSUER, APPLE_REVOKE_URL, APPLE_TOKEN_URL } from './providers/apple';
import { GoogleProvider, GOOGLE_TOKEN_URL } from './providers/google';

const BUNDLE_ID = 'com.nextlabs.coachcal';
const GOOGLE_CLIENT_ID = 'google-client-id.apps.googleusercontent.com';
const KID = 'test-key-1';

const appleConfig: AppleConfig = {
  configured: true,
  missing: [],
  bundleId: BUNDLE_ID,
  teamId: 'TEAMID1234',
  keyId: 'KEYID12345',
  privateKeyPath: '',
};
const googleConfig: GoogleConfig = {
  configured: true,
  missing: [],
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: 'google-client-secret',
  redirectUri: 'https://api.example.test/v1/auth/google/callback',
};

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

interface Signer {
  privateKey: PrivateKey;
  jwks: ReturnType<typeof createLocalJWKSet>;
}

async function makeSigner(): Promise<Signer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

interface TokenOptions {
  issuer: string;
  audience: string;
  subject?: string;
  nonce?: string;
  email?: string;
  emailVerified?: boolean;
  expiresInSeconds?: number;
  key?: PrivateKey;
}

async function idToken(signer: Signer, options: TokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    ...(options.nonce !== undefined ? { nonce: options.nonce } : {}),
    ...(options.email !== undefined ? { email: options.email, email_verified: options.emailVerified ?? true } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setSubject(options.subject ?? 'subject-1')
    .setIssuedAt(now - 10)
    .setExpirationTime(now + (options.expiresInSeconds ?? 600))
    .sign(options.key ?? signer.privateKey);
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type FetchCall = { url: string; body: URLSearchParams };

const parseSession = async (res: Response): Promise<SessionResponse> => SessionResponseSchema.parse(await res.json());

async function track(h: Harness, res: Response): Promise<SessionResponse> {
  const session = await parseSession(res);
  h.track(session.user.id, session.user.email ?? undefined);
  return session;
}

async function userCount(h: Harness, where: string, ...params: string[]): Promise<number> {
  const [row] = await h.owner.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM public.users WHERE ${where}`, params);
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------------------------
// Providers that are not configured
// ---------------------------------------------------------------------------------------------
describeSql('sign-in routes while Apple and Google are not configured', (harness) => {
  it('Apple sign-in answers 503 UPSTREAM_ERROR and names the missing variables', async () => {
    const res = await harness().post('/v1/auth/apple', { identityToken: 'x', nonce: 'y' });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; details: string[] } };
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(body.error.details[0]).toMatch(/Apple sign-in is not configured: set APPLE_BUNDLE_ID/);
  });

  it('Google start and callback answer 503 UPSTREAM_ERROR and name the missing variables', async () => {
    for (const path of ['/v1/auth/google/start', '/v1/auth/google/callback']) {
      const res = await harness().call('GET', path);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: { code: string; details: string[] } };
      expect(body.error.code).toBe('UPSTREAM_ERROR');
      expect(body.error.details[0]).toMatch(/Google sign-in is not configured: set GOOGLE_CLIENT_ID/);
    }
  });

  it('a Google one-time code that was never issued is rejected with 401', async () => {
    const res = await harness().post('/v1/auth/google/exchange', { code: 'never-issued' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------------------------
let apple: { signer: Signer; calls: FetchCall[]; respond: (url: string) => Response } | undefined;

async function appleHarnessOptions() {
  const signer = await makeSigner();
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const calls: FetchCall[] = [];
  const state = {
    signer,
    calls,
    respond: (url: string): Response =>
      url === APPLE_TOKEN_URL ? json({ refresh_token: 'apple-refresh-token-1' }) : new Response('', { status: 200 }),
  };
  apple = state;
  const provider = new AppleProvider({
    config: appleConfig,
    privateKeyPem: await exportPKCS8(privateKey),
    getKey: signer.jwks,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: new URLSearchParams(String(init?.body ?? '')) });
      return state.respond(String(url));
    }) as typeof fetch,
  });
  return { apple: provider };
}

// Jest evaluates describe bodies synchronously, so the async key generation happens in beforeAll
// and the harness reads the providers lazily (describeSql takes a function for its options).
let appleProviderForHarness: AppleProvider | undefined;
beforeAll(async () => {
  appleProviderForHarness = (await appleHarnessOptions()).apple;
});

describeSql('POST /v1/auth/apple', (harness) => {
  const nonce = 'raw-nonce-value';
  const hashed = sha256Hex(nonce);
  const sign = (overrides: Partial<TokenOptions> = {}) =>
    idToken(apple!.signer, {
      issuer: APPLE_ISSUER,
      audience: BUNDLE_ID,
      subject: `apple-${crypto.randomUUID()}`,
      nonce: hashed,
      email: `apple-${crypto.randomUUID()}@example.test`,
      ...overrides,
    });

  afterEach(async () => {
    await harness().cleanupData();
  });

  it('verifies the identity token, creates the user and returns a contract-valid session', async () => {
    const h = harness();
    const subject = `apple-${crypto.randomUUID()}`;
    const email = `Apple-${crypto.randomUUID()}@Example.test`;
    const token = await sign({ subject, email });
    const res = await h.post('/v1/auth/apple', { identityToken: token, nonce });
    expect(res.status).toBe(200);
    const session = await track(h, res);
    expect(session.user.email).toBe(email.toLowerCase());
    expect(session.user.providers).toEqual(['apple']);

    // The same Apple subject signs in to the same account.
    const again = await track(h, await h.post('/v1/auth/apple', { identityToken: await sign({ subject, email }), nonce }));
    expect(again.user.id).toBe(session.user.id);

    // The new access token opens a protected route.
    const protectedCall = await h.post('/v1/sync/pull', { cursor: 0 }, session.tokens.accessToken);
    expect(protectedCall.status).toBe(200);
  });

  it('exchanges the authorization code and stores the Apple refresh token encrypted', async () => {
    const h = harness();
    apple!.calls.length = 0;
    const subject = `apple-${crypto.randomUUID()}`;
    const res = await h.post('/v1/auth/apple', {
      identityToken: await sign({ subject }),
      nonce,
      authorizationCode: 'auth-code-1',
    });
    expect(res.status).toBe(200);
    await track(h, res);

    const call = apple!.calls.find((c) => c.url === APPLE_TOKEN_URL);
    expect(call?.body.get('grant_type')).toBe('authorization_code');
    expect(call?.body.get('code')).toBe('auth-code-1');
    expect(call?.body.get('client_id')).toBe(BUNDLE_ID);
    expect(call?.body.get('client_secret')).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

    const [row] = await h.owner<{ apple_refresh_token_enc: string }[]>`
      SELECT apple_refresh_token_enc FROM public.auth_identities WHERE provider = 'apple' AND subject = ${subject}`;
    const stored = row?.apple_refresh_token_enc ?? '';
    expect(stored).not.toContain('apple-refresh-token-1');
    expect(decryptSecret(stored, deriveKey(TEST_ENCRYPTION_KEY, 'apple-refresh-token'))).toBe('apple-refresh-token-1');
  });

  it('rejects an identity token with a bad signature', async () => {
    const h = harness();
    const { privateKey: stranger } = await generateKeyPair('RS256');
    const res = await h.post('/v1/auth/apple', { identityToken: await sign({ key: stranger }), nonce });
    expect(res.status).toBe(401);
  });

  it('rejects an identity token minted for another audience', async () => {
    const h = harness();
    const res = await h.post('/v1/auth/apple', { identityToken: await sign({ audience: 'com.other.app' }), nonce });
    expect(res.status).toBe(401);
  });

  it('rejects an identity token from another issuer', async () => {
    const h = harness();
    const res = await h.post('/v1/auth/apple', { identityToken: await sign({ issuer: 'https://evil.example' }), nonce });
    expect(res.status).toBe(401);
  });

  it('rejects an identity token whose nonce does not match the raw nonce', async () => {
    const h = harness();
    const res = await h.post('/v1/auth/apple', { identityToken: await sign(), nonce: 'a-different-nonce' });
    expect(res.status).toBe(401);
    const missing = await h.post('/v1/auth/apple', { identityToken: await sign({ nonce: undefined }), nonce });
    expect(missing.status).toBe(401);
  });

  it('rejects an expired identity token', async () => {
    const h = harness();
    const res = await h.post('/v1/auth/apple', { identityToken: await sign({ expiresInSeconds: -120 }), nonce });
    expect(res.status).toBe(401);
  });

  it('creates no user when Apple rejects the authorization code', async () => {
    const h = harness();
    const subject = `apple-${crypto.randomUUID()}`;
    apple!.respond = () => json({ error: 'invalid_grant' }, 400);
    try {
      const res = await h.post('/v1/auth/apple', {
        identityToken: await sign({ subject }),
        nonce,
        authorizationCode: 'bad-code',
      });
      expect(res.status).toBe(401);
      const [row] = await h.owner<{ n: number }[]>`
        SELECT count(*)::int AS n FROM public.auth_identities WHERE provider = 'apple' AND subject = ${subject}`;
      expect(row?.n).toBe(0);
    } finally {
      apple!.respond = (url) => (url === APPLE_TOKEN_URL ? json({ refresh_token: 'apple-refresh-token-1' }) : new Response('', { status: 200 }));
    }
  });

  it('answers 503 when Apple cannot be reached', async () => {
    const h = harness();
    apple!.respond = () => {
      throw new Error('network down');
    };
    try {
      const res = await h.post('/v1/auth/apple', {
        identityToken: await sign(),
        nonce,
        authorizationCode: 'auth-code-2',
      });
      expect(res.status).toBe(503);
    } finally {
      apple!.respond = (url) => (url === APPLE_TOKEN_URL ? json({ refresh_token: 'apple-refresh-token-1' }) : new Response('', { status: 200 }));
    }
  });

  it('account deletion revokes the stored Apple refresh token after the data is gone', async () => {
    const h = harness();
    const session = await track(
      h,
      await h.post('/v1/auth/apple', { identityToken: await sign(), nonce, authorizationCode: 'auth-code-3' }),
    );
    apple!.calls.length = 0;
    const res = await h.call('DELETE', '/v1/account', session.tokens.accessToken);
    expect(res.status).toBe(200);
    const revoke = apple!.calls.find((c) => c.url === APPLE_REVOKE_URL);
    expect(revoke?.body.get('token')).toBe('apple-refresh-token-1');
    expect(revoke?.body.get('token_type_hint')).toBe('refresh_token');
    expect(await userCount(h, 'id = $1::uuid', session.user.id)).toBe(0);
  });

  it('account deletion still succeeds when the Apple revoke call fails', async () => {
    const h = harness();
    const session = await track(
      h,
      await h.post('/v1/auth/apple', { identityToken: await sign(), nonce, authorizationCode: 'auth-code-4' }),
    );
    apple!.respond = () => new Response('', { status: 500 });
    try {
      const res = await h.call('DELETE', '/v1/account', session.tokens.accessToken);
      expect(res.status).toBe(200);
      expect(await userCount(h, 'id = $1::uuid', session.user.id)).toBe(0);
    } finally {
      apple!.respond = (url) => (url === APPLE_TOKEN_URL ? json({ refresh_token: 'apple-refresh-token-1' }) : new Response('', { status: 200 }));
    }
  });
}, () => ({ apple: appleProviderForHarness }));

// ---------------------------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------------------------
let google: { signer: Signer; respond: (call: FetchCall) => Response; calls: FetchCall[]; provider: GoogleProvider } | undefined;

async function googleHarnessOptions() {
  const signer = await makeSigner();
  const calls: FetchCall[] = [];
  const state = {
    signer,
    calls,
    respond: (_call: FetchCall): Response => json({ error: 'not set up' }, 500),
    provider: undefined as unknown as GoogleProvider,
  };
  state.provider = new GoogleProvider({
    config: googleConfig,
    stateSecret: deriveKey(TEST_ENCRYPTION_KEY, 'google-state'),
    getKey: signer.jwks,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), body: new URLSearchParams(String(init?.body ?? '')) };
      calls.push(call);
      return state.respond(call);
    }) as typeof fetch,
  });
  google = state;
  return state.provider;
}

let googleProviderForHarness: GoogleProvider | undefined;
beforeAll(async () => {
  googleProviderForHarness = await googleHarnessOptions();
});

describeSql('Google sign-in through the system browser', (harness) => {
  afterEach(async () => {
    await harness().cleanupData();
  });

  /** start -> {cookie value n, state} exactly as the browser would carry them. */
  async function start(h: Harness) {
    const res = await h.call('GET', '/v1/auth/google/start');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') ?? '');
    const setCookie = res.headers.get('set-cookie') ?? '';
    const n = /cc_google_state=([^;]+)/.exec(setCookie)?.[1] ?? '';
    return { res, location, setCookie, n, state: location.searchParams.get('state') ?? '' };
  }

  const callback = (h: Harness, query: Record<string, string>, n?: string) =>
    h.call('GET', `/v1/auth/google/callback?${new URLSearchParams(query).toString()}`, undefined, n ? { cookie: `cc_google_state=${n}` } : {});

  function grantIdToken(n: string, overrides: Partial<TokenOptions> = {}) {
    google!.respond = () => json({ id_token: 'placeholder' });
    return idToken(google!.signer, {
      issuer: 'https://accounts.google.com',
      audience: GOOGLE_CLIENT_ID,
      subject: `google-${crypto.randomUUID()}`,
      nonce: sha256Hex(n),
      email: `google-${crypto.randomUUID()}@example.test`,
      ...overrides,
    });
  }

  it('start redirects to Google with state, nonce and an HttpOnly cookie that binds this browser', async () => {
    const h = harness();
    const { location, setCookie, n, state } = await start(h);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe(GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(googleConfig.redirectUri);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('nonce')).toBe(sha256Hex(n));
    expect(state).not.toBe('');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Secure/i);
  });

  it('a full round trip ends in a one-time code that opens exactly one session', async () => {
    const h = harness();
    const { n, state } = await start(h);
    const token = await grantIdToken(n);
    google!.respond = (call) => (call.url === GOOGLE_TOKEN_URL ? json({ id_token: token }) : json({}, 404));

    const redirect = await callback(h, { state, code: 'google-auth-code' }, n);
    expect(redirect.status).toBe(302);
    const target = new URL(redirect.headers.get('location') ?? '');
    expect(`${target.protocol}//${target.host}${target.pathname}`).toBe('coachcal://auth/google');
    const code = target.searchParams.get('code') ?? '';
    expect(code).not.toBe('');
    // No token ever appears in the redirect URL.
    expect(target.toString()).not.toMatch(/eyJ/);

    const exchanged = await track(h, await h.post('/v1/auth/google/exchange', { code }));
    expect(exchanged.user.providers).toEqual(['google']);

    const reused = await h.post('/v1/auth/google/exchange', { code });
    expect(reused.status).toBe(401);
  });

  it('an expired one-time code is rejected', async () => {
    const h = harness();
    const { n, state } = await start(h);
    const token = await grantIdToken(n);
    google!.respond = () => json({ id_token: token });
    const redirect = await callback(h, { state, code: 'google-auth-code' }, n);
    const code = new URL(redirect.headers.get('location') ?? '').searchParams.get('code') ?? '';
    await h.owner`UPDATE public.auth_one_time_codes SET expires_at = now() - interval '1 second' WHERE code_hash = ${sha256Hex(code)}`;
    const res = await h.post('/v1/auth/google/exchange', { code });
    expect(res.status).toBe(401);
  });

  it('a callback without the cookie, with a foreign state or with an expired state redirects with an error', async () => {
    const h = harness();
    const { n, state } = await start(h);
    google!.respond = () => json({ error: 'must not be called' }, 500);
    google!.calls.length = 0;

    const noCookie = await callback(h, { state, code: 'c' });
    expect(noCookie.headers.get('location')).toBe('coachcal://auth/google?error=invalid_state');

    const foreignCookie = await callback(h, { state, code: 'c' }, 'another-browsers-value');
    expect(foreignCookie.headers.get('location')).toBe('coachcal://auth/google?error=invalid_state');

    const forged = await callback(h, { state: `${Math.floor(Date.now() / 1000) + 600}.${'0'.repeat(64)}`, code: 'c' }, n);
    expect(forged.headers.get('location')).toBe('coachcal://auth/google?error=invalid_state');

    const expired = await callback(h, { state: `${Math.floor(Date.now() / 1000) - 5}.${'0'.repeat(64)}`, code: 'c' }, n);
    expect(expired.headers.get('location')).toBe('coachcal://auth/google?error=invalid_state');

    const denied = await callback(h, { error: 'access_denied', state }, n);
    expect(denied.headers.get('location')).toBe('coachcal://auth/google?error=denied');

    expect(google!.calls).toHaveLength(0);
  });

  it('an ID token with the wrong nonce, audience, issuer, signature or expiry is rejected', async () => {
    const h = harness();
    const { privateKey: stranger } = await generateKeyPair('RS256');
    const cases: Partial<TokenOptions>[] = [
      { nonce: sha256Hex('another-browser') },
      { audience: 'someone-elses-client-id' },
      { issuer: 'https://evil.example' },
      { key: stranger },
      { expiresInSeconds: -120 },
    ];
    for (const overrides of cases) {
      const { n, state } = await start(h);
      const token = await grantIdToken(n, overrides);
      google!.respond = () => json({ id_token: token });
      const redirect = await callback(h, { state, code: 'google-auth-code' }, n);
      expect(redirect.headers.get('location')).toBe('coachcal://auth/google?error=rejected');
    }
  });

  it('Google rejecting the code or being unreachable redirects with an error and creates nothing', async () => {
    const h = harness();
    const before = await userCount(h, 'true');
    const first = await start(h);
    google!.respond = () => json({ error: 'invalid_grant' }, 400);
    const rejected = await callback(h, { state: first.state, code: 'c' }, first.n);
    expect(rejected.headers.get('location')).toBe('coachcal://auth/google?error=rejected');

    const second = await start(h);
    google!.respond = () => {
      throw new Error('network down');
    };
    const unreachable = await callback(h, { state: second.state, code: 'c' }, second.n);
    expect(unreachable.headers.get('location')).toBe('coachcal://auth/google?error=unavailable');
    expect(await userCount(h, 'true')).toBe(before);
  });
}, () => ({ google: googleProviderForHarness, env: { PUBLIC_BASE_URL: 'https://api.example.test' } }));
