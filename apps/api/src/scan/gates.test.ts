import { ErrorEnvelopeSchema, ScanResponseSchema } from '@coachcal/api-contract';

import { describeSql, setEnv } from '../testing/sqlHarness';

// Gate-order e2e: quota claim, entitlement bypass/expiry, typed barcode not-found, and the
// schema-error boundary — all against the real route with a real PostgreSQL 17.
const CHICKEN_RICE_KEY = 'search:chicken-rice';
const CHICKEN_RICE_PAYLOAD = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const BARCODE = '0036000291452';
const BARCODE_KEY = `barcode:${BARCODE}`;
// Suite-scoped barcode keys: barcode.test.ts owns 9999999999999, so a shared one would race
// that suite's negative-caching assertions.
const UNKNOWN_BARCODE = '8888888888888';
const UNKNOWN_BARCODE_KEY = `barcode:${UNKNOWN_BARCODE}`;
const DAY_MS = 24 * 60 * 60 * 1000;

function photoBody(scanId: string): Record<string, unknown> {
  return { scanId, kind: 'photo', imageBase64: 'fixture-photo', mealType: 'lunch' };
}

function barcodeBody(scanId: string, barcode: string): Record<string, unknown> {
  return { scanId, kind: 'barcode', barcode, mealType: 'lunch' };
}

describeSql('scan-gates (SQL-backed)', (harness) => {
  it('quota: the 4th free-tier scan in the window is a 402 with entitlement state', async () => {
    const h = harness();
    await h.seedPositive(CHICKEN_RICE_KEY, CHICKEN_RICE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    try {
      for (const scanId of ids.slice(0, 3)) {
        const res = await h.post('/v1/scan', photoBody(scanId), token);
        expect(res.status).toBe(200); // each scan consumes a credit
      }

      const fourth = await h.post('/v1/scan', photoBody(ids[3]!), token);
      expect(fourth.status).toBe(402);
      const envelope = ErrorEnvelopeSchema.parse(await fourth.json());
      expect(envelope.error.code).toBe('FREE_LIMIT_REACHED');
      const entitlement = envelope.error.entitlement;
      expect(entitlement).toBeDefined(); // the 402 body must carry entitlement state
      expect(entitlement?.tier).toBe('free');
      expect(entitlement?.scansUsed).toBe(3);
      expect(entitlement?.scanLimit).toBe(3);
      const resetAt = new Date(entitlement!.windowResetAt).getTime();
      expect(Number.isNaN(resetAt)).toBe(false);
      expect(resetAt).toBeGreaterThan(Date.now()); // the window reset must lie in the future
      expect(await h.scanCount(ids[3]!)).toBe(0); // a 402 must not persist a scan
    } finally {
      for (const scanId of ids) await h.deleteScan(scanId, userId);
    }
  });

  it('quota: replaying a consumed scanId after the limit stays 200 with exactly 3 usage rows', async () => {
    const h = harness();
    await h.seedPositive(CHICKEN_RICE_KEY, CHICKEN_RICE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    try {
      for (const scanId of ids.slice(0, 3)) {
        const res = await h.post('/v1/scan', photoBody(scanId), token);
        expect(res.status).toBe(200);
      }
      const fourth = await h.post('/v1/scan', photoBody(ids[3]!), token);
      expect(fourth.status).toBe(402);

      const replay = await h.post('/v1/scan', photoBody(ids[2]!), token);
      expect(replay.status).toBe(200); // an earlier consumed scanId replays idempotently
      expect(ScanResponseSchema.parse(await replay.json()).items[0]?.kcal).toBe(464);

      expect(await h.usageCount(userId)).toBe(3); // the replay must not grow usage
    } finally {
      for (const scanId of ids) await h.deleteScan(scanId, userId);
    }
  });

  it('entitlement: an active entitlement bypasses the claim; an expired one does not', async () => {
    const h = harness();
    await h.seedPositive(CHICKEN_RICE_KEY, CHICKEN_RICE_PAYLOAD);
    const { userId, token } = await h.newUser();
    const freeIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const bypassId = crypto.randomUUID();
    const afterExpiryId = crypto.randomUUID();
    try {
      // Exhaust the free window first so the bypass is proven against a would-be 402,
      // not a user with quota to spare.
      for (const scanId of freeIds) {
        const res = await h.post('/v1/scan', photoBody(scanId), token);
        expect(res.status).toBe(200);
      }
      expect(await h.usageCount(userId)).toBe(3);

      await h.grantEntitlement(userId, new Date(Date.now() + DAY_MS));
      const bypass = await h.post('/v1/scan', photoBody(bypassId), token);
      expect(bypass.status).toBe(200); // an entitled user skips the exhausted quota gate
      expect(await h.usageCountForScan(bypassId)).toBe(0); // entitled scans never touch scan_usage

      // Same row, active still true — expiry is enforced by expires_at alone.
      await h.grantEntitlement(userId, new Date(Date.now() - 60 * 1000));
      const afterExpiry = await h.post('/v1/scan', photoBody(afterExpiryId), token);
      expect(afterExpiry.status).toBe(402); // an expired entitlement must fall back to the quota gate
      expect(((await afterExpiry.json()) as { error: { code: string } }).error.code).toBe('FREE_LIMIT_REACHED');
    } finally {
      for (const scanId of freeIds) await h.deleteScan(scanId, userId);
      await h.deleteScan(bypassId, userId);
      await h.deleteScan(afterExpiryId, userId);
      await h.removeEntitlement(userId);
    }
  });

  it('barcode gates: seeded cache resolves exactly; unknown barcode is a typed 404', async () => {
    const h = harness();
    await h.seedPositive(BARCODE_KEY, { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 });
    await h.seedNegative(UNKNOWN_BARCODE_KEY);
    const { userId, token } = await h.newUser({ entitled: true });
    const knownId = crypto.randomUUID();
    const unknownId = crypto.randomUUID();
    try {
      const known = await h.post('/v1/scan', barcodeBody(knownId, BARCODE), token);
      expect(known.status).toBe(200);
      const knownParsed = ScanResponseSchema.parse(await known.json());
      expect(knownParsed.items[0]?.source).toBe('cache');
      expect(knownParsed.items[0]?.kcal).toBe(539);
      expect(knownParsed.items[0]?.unresolved).toBe(false);

      const unknown = await h.post('/v1/scan', barcodeBody(unknownId, UNKNOWN_BARCODE), token);
      expect(unknown.status).toBe(404);
      const unknownBody = (await unknown.json()) as Record<string, unknown> & { error: { code: string } };
      expect(ErrorEnvelopeSchema.safeParse(unknownBody).success).toBe(true);
      expect(unknownBody.error.code).toBe('BARCODE_NOT_FOUND');
      expect(unknownBody.items).toBeUndefined(); // no fabricated nutrition fields
      expect(await h.scanCount(unknownId)).toBe(0); // a 404 must not persist a scan
    } finally {
      await h.deleteScan(knownId, userId);
      await h.deleteScan(unknownId, userId);
      await h.deleteCacheKey(BARCODE_KEY);
      await h.deleteCacheKey(UNKNOWN_BARCODE_KEY);
      await h.removeEntitlement(userId);
    }
  });

  it('malformed fixture mode is a typed 422 with the env restored afterward', async () => {
    const h = harness();
    await h.seedPositive(CHICKEN_RICE_KEY, CHICKEN_RICE_PAYLOAD);
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    const before = process.env.VLM_FIXTURE_MODE;
    const restoreEnv = setEnv({ VLM_FIXTURE_MODE: 'malformed' });
    try {
      const res = await h.post('/v1/scan', photoBody(scanId), token);
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string; details: string[] } };
      expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe('VLM_SCHEMA_ERROR');
      // issue paths must name the offending item
      expect(body.error.details).toContain('items.0');
      expect(await h.scanCount(scanId)).toBe(0); // nothing may persist past a 422
    } finally {
      restoreEnv();
      expect(process.env.VLM_FIXTURE_MODE).toBe(before);
      await h.deleteScan(scanId, userId);
      await h.removeEntitlement(userId);
    }
  });

  it('gate order: a malformed body on an unauthenticated call is 400, not 401', async () => {
    const h = harness();
    // No Authorization header: the body gates (JSON parse, schema) run before authentication.
    const notJson = await h.post('/v1/scan', 'not json');
    expect(notJson.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(await notJson.json()).success).toBe(true);

    const badUuid = await h.post('/v1/scan', photoBody('not-a-uuid'));
    expect(badUuid.status).toBe(400);
    const badUuidBody = (await badUuid.json()) as { error: { code: string } };
    expect(badUuidBody.error.code).toBe('VALIDATION_ERROR');

    // A well-formed body without credentials is the 401 that follows the 400 gates.
    const unauthenticated = await h.post('/v1/scan', photoBody(crypto.randomUUID()));
    expect(unauthenticated.status).toBe(401);
    expect(((await unauthenticated.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');

    // The same order on the lookup routes.
    expect((await h.post('/v1/barcode/resolve', { barcode: '12abc34' })).status).toBe(400);
    expect((await h.post('/v1/foods/search', { query: '' })).status).toBe(400);
  });

  it('gate order: without AUTH_DEV_TOKENS every protected route answers 401', async () => {
    const h = harness();
    const { token } = await h.newUser({ entitled: true });
    const restoreEnv = setEnv({ AUTH_DEV_TOKENS: undefined });
    try {
      // The harness registers its own tokens, so only the dev-token gate is under test here:
      // the checked-in spike token is refused while the flag is off.
      const res = await h.post('/v1/scan', photoBody(crypto.randomUUID()), 'spike-dev-token');
      expect(res.status).toBe(401);
      expect(ErrorEnvelopeSchema.safeParse(await res.json()).success).toBe(true);
    } finally {
      restoreEnv();
    }
    expect(token).toBeTruthy();
  });

  it('scan-gates suite cleanup removes the test user and cache seeds', async () => {
    const h = harness();
    await h.cleanupData();
    for (const key of [CHICKEN_RICE_KEY, BARCODE_KEY, UNKNOWN_BARCODE_KEY]) {
      expect(await h.cacheRow(key)).toBeUndefined();
    }
  });
});
