/**
 * Twins of supabase/functions/tests/webhook.test.ts: 10 hmac cases, 10 schema / mapping cases and 13
 * handler cases (the handler cases run against the real `webhook_apply` function on the throwaway
 * PostgreSQL 17 and skip loudly without it). The test sentences are the old ones.
 */
import { createHmac } from 'node:crypto';

import {
  RC_EVENT_TYPES,
  RcWebhookEnvelopeSchema,
  eventTypePolicy,
  toWebhookEvent,
  type RcEventType,
} from '@coachcal/api-contract';
import { Hono } from 'hono';

import { describeSql, TEST_WEBHOOK_SECRET as HARNESS_SECRET } from '../testing/sqlHarness';
import { registerWebhookRoute } from './route';
import { SIGNATURE_MAX_AGE_SECONDS, timingSafeHexEqual, verifyRcHmac } from './hmac';

const TEST_SECRET = HARNESS_SECRET;

const hmacHex = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

function signHeader(raw: string, secret = TEST_SECRET, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmacHex(`${timestamp}.${raw}`, secret)}`;
}

const rawBody = JSON.stringify({
  event: {
    id: 'evt_1',
    type: 'RENEWAL',
    data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
  },
});

describe('hmac', () => {
  it('hmac: a valid t/v1 signature over the exact raw body verifies', async () => {
    expect(verifyRcHmac(rawBody, signHeader(rawBody), TEST_SECRET)).toBe(true);
  });

  it('hmac: one altered body byte fails', async () => {
    const tampered = rawBody.replace('evt_1', 'evt_2');
    expect(tampered).not.toBe(rawBody);
    expect(verifyRcHmac(tampered, signHeader(rawBody), TEST_SECRET)).toBe(false);
  });

  it('hmac: a v1 from a different secret fails', async () => {
    expect(verifyRcHmac(rawBody, signHeader(rawBody, 'another-secret'), TEST_SECRET)).toBe(false);
  });

  it('hmac: a timestamp 301 seconds old fails', async () => {
    const stale = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS + 1);
    expect(verifyRcHmac(rawBody, signHeader(rawBody, TEST_SECRET, stale), TEST_SECRET)).toBe(false);
  });

  it('hmac: a timestamp 299 seconds old passes', async () => {
    const recent = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS - 1);
    expect(verifyRcHmac(rawBody, signHeader(rawBody, TEST_SECRET, recent), TEST_SECRET)).toBe(true);
  });

  it('hmac: a future timestamp beyond tolerance fails', async () => {
    const future = Math.floor(Date.now() / 1000) + SIGNATURE_MAX_AGE_SECONDS + 1;
    expect(verifyRcHmac(rawBody, signHeader(rawBody, TEST_SECRET, future), TEST_SECRET)).toBe(false);
  });

  it('hmac: malformed headers fail', async () => {
    const futureProofV1 = hmacHex(`${Math.floor(Date.now() / 1000)}.${rawBody}`, TEST_SECRET);
    const malformed = [
      '',
      't=123',
      'v1=abc',
      't=abc,v1=' + futureProofV1,
      `t=123,v1=${'g'.repeat(64)}`,
      't=123,v1=abcd',
      `t=123,v1=${futureProofV1},extra=1`,
      `T=123,v1=${futureProofV1}`,
    ];
    for (const header of malformed) {
      expect(verifyRcHmac(rawBody, header, TEST_SECRET)).toBe(false);
    }
  });

  it('hmac: timingSafeHexEqual ab00 vs ab01 is false', () => {
    expect(timingSafeHexEqual('ab00', 'ab01')).toBe(false);
  });

  it('hmac: timingSafeHexEqual compares equal-length inputs in full', () => {
    expect(timingSafeHexEqual('abcdef01', 'abcdef01')).toBe(true);
    expect(timingSafeHexEqual('abcdef01', 'abcdef02')).toBe(false);
  });

  it('hmac: timingSafeHexEqual never matches different lengths', () => {
    expect(timingSafeHexEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeHexEqual('', 'a')).toBe(false);
  });
});

const validEnvelope = {
  event: {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
  },
};

describe('envelope schema and event mapping', () => {
  it('RcWebhookEnvelopeSchema accepts a valid envelope and defaults entitlement_ids', () => {
    const parsed = RcWebhookEnvelopeSchema.parse({
      event: { id: 'evt_1', type: 'INITIAL_PURCHASE', data: { app_user_id: 'user-1' } },
    });
    expect(parsed.event.data.entitlement_ids).toEqual([]);
  });

  it('RcWebhookEnvelopeSchema rejects unknown keys at every level', () => {
    const extraData = structuredClone(validEnvelope);
    (extraData.event.data as Record<string, unknown>).kcal = 100;
    expect(() => RcWebhookEnvelopeSchema.parse(extraData)).toThrow();

    const extraEvent = structuredClone(validEnvelope);
    (extraEvent.event as Record<string, unknown>).source = 'revenuecat';
    expect(() => RcWebhookEnvelopeSchema.parse(extraEvent)).toThrow();

    const extraTop = { ...validEnvelope, mode: 'malformed' };
    expect(() => RcWebhookEnvelopeSchema.parse(extraTop)).toThrow();
  });

  it('RcWebhookEnvelopeSchema rejects an unknown event type', () => {
    expect(() =>
      RcWebhookEnvelopeSchema.parse({
        event: { id: 'evt_1', type: 'TRANSFER', data: { app_user_id: 'user-1' } },
      }),
    ).toThrow();
  });

  it('eventTypePolicy classifies all nine event types', () => {
    const grants = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED'];
    for (const type of grants) {
      expect(eventTypePolicy(type as RcEventType)).toBe('grant');
    }
    expect(eventTypePolicy('EXPIRATION')).toBe('revoke');
    for (const type of ['CANCELLATION', 'SUBSCRIPTION_PAUSED', 'BILLING_ISSUE']) {
      expect(eventTypePolicy(type as RcEventType)).toBe('ledger-only');
    }
    expect(RC_EVENT_TYPES.length).toBe(9);
  });

  it('toWebhookEvent keeps access active for every type except EXPIRATION', () => {
    for (const type of RC_EVENT_TYPES) {
      const inputs = toWebhookEvent({
        event: { id: 'evt_1', type, data: { app_user_id: 'user-1', entitlement_ids: ['premium'] } },
      } as never);
      expect(inputs.length).toBe(1);
      expect(inputs[0]?.active).toBe(type !== 'EXPIRATION');
    }
  });

  it('toWebhookEvent maps expiration_at_ms to canonical ISO and omits when absent', () => {
    const withExpiry = toWebhookEvent({
      event: {
        id: 'evt_1',
        type: 'RENEWAL',
        data: { app_user_id: 'user-1', entitlement_ids: ['premium'], expiration_at_ms: 1798761600123 },
      },
    } as never);
    expect(withExpiry[0]?.expiresAt).toBe(new Date(1798761600123).toISOString());

    const withoutExpiry = toWebhookEvent({
      event: {
        id: 'evt_2',
        type: 'RENEWAL',
        data: { app_user_id: 'user-1', entitlement_ids: ['premium'], expiration_at_ms: null },
      },
    } as never);
    expect(withoutExpiry[0]?.expiresAt).toBeUndefined();
  });

  it('RcWebhookEnvelopeSchema accepts event.timestamp_ms and toWebhookEvent forwards it', () => {
    const parsed = RcWebhookEnvelopeSchema.parse({
      event: {
        id: 'evt_1',
        type: 'RENEWAL',
        timestamp_ms: 1_700_000_000_000,
        data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
      },
    });
    expect(parsed.event.timestamp_ms).toBe(1_700_000_000_000);
    const [input] = toWebhookEvent(parsed);
    expect(input?.timestampMs).toBe(1_700_000_000_000);

    const without = toWebhookEvent({
      event: { id: 'evt_2', type: 'RENEWAL', data: { app_user_id: 'user-1', entitlement_ids: ['premium'] } },
    } as never);
    expect(without[0]?.timestampMs).toBeUndefined();
  });

  it('toWebhookEvent produces one RPC input per entitlement id', () => {
    const inputs = toWebhookEvent({
      event: {
        id: 'evt_1',
        type: 'INITIAL_PURCHASE',
        data: { app_user_id: 'user-1', entitlement_ids: ['premium', 'bonus'] },
      },
    } as never);
    expect(inputs.length).toBe(2);
    expect(inputs.map((i) => i.entitlementId)).toEqual(['premium', 'bonus']);
    expect(new Set(inputs.map((i) => i.eventId)).size).toBe(1);
    expect(new Set(inputs.map((i) => i.appUserId)).size).toBe(1);
  });

  it('toWebhookEvent maps a uuid app_user_id to supabaseUserId, omits otherwise', () => {
    const uuid = '11111111-2222-4333-8444-555555555555';
    const mapped = toWebhookEvent({
      event: { id: 'evt_1', type: 'RENEWAL', data: { app_user_id: uuid, entitlement_ids: ['premium'] } },
    } as never);
    expect(mapped[0]?.supabaseUserId).toBe(uuid);

    const unmapped = toWebhookEvent({
      event: {
        id: 'evt_2',
        type: 'RENEWAL',
        data: { app_user_id: '$RCAnonymousID:abc123', entitlement_ids: ['premium'] },
      },
    } as never);
    expect(unmapped[0]?.supabaseUserId).toBeUndefined();
  });

  it('toWebhookEvent passes product_id through and omits null', () => {
    const withProduct = toWebhookEvent({
      event: {
        id: 'evt_1',
        type: 'RENEWAL',
        data: { app_user_id: 'user-1', entitlement_ids: ['premium'], product_id: 'cal_premium_monthly' },
      },
    } as never);
    expect(withProduct[0]?.productId).toBe('cal_premium_monthly');

    const withoutProduct = toWebhookEvent({
      event: {
        id: 'evt_2',
        type: 'RENEWAL',
        data: { app_user_id: 'user-1', entitlement_ids: ['premium'], product_id: null },
      },
    } as never);
    expect(withoutProduct[0]?.productId).toBeUndefined();
  });
});

const TEST_APP_USER_ID = '11111111-2222-4333-8444-555555555555';
const TEST_ENTITLEMENT = 'premium';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_PATH = '/webhooks/revenuecat';
const SIGNATURE = 'X-RevenueCat-Webhook-Signature';

const uniqueEventId = (): string => `whk-itest-${crypto.randomUUID()}`;

function eventJson(opts: {
  eventId: string;
  type: RcEventType;
  appUserId?: string;
  entitlementIds?: string[];
  expirationAtMs?: number | null;
  productId?: string;
  timestampMs?: number;
}): string {
  return JSON.stringify({
    event: {
      id: opts.eventId,
      type: opts.type,
      ...(opts.timestampMs !== undefined ? { timestamp_ms: opts.timestampMs } : {}),
      data: {
        app_user_id: opts.appUserId ?? TEST_APP_USER_ID,
        entitlement_ids: opts.entitlementIds ?? [TEST_ENTITLEMENT],
        expiration_at_ms: opts.expirationAtMs ?? null,
        ...(opts.productId !== undefined ? { product_id: opts.productId } : {}),
      },
    },
  });
}

describeSql('webhook handler against the real webhook_apply function', (harness) => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const send = (raw: string, headers: Record<string, string> = {}) =>
    harness().post(WEBHOOK_PATH, raw, undefined, headers);

  const signed = (raw: string, secret = TEST_SECRET, timestamp = Math.floor(Date.now() / 1000)) =>
    send(raw, { [SIGNATURE]: signHeader(raw, secret, timestamp) });

  async function cleanupTestData(): Promise<void> {
    const owner = harness().owner;
    await owner`DELETE FROM public.entitlements WHERE app_user_id = ${TEST_APP_USER_ID}`;
    await owner`DELETE FROM public.webhook_events WHERE event_id LIKE 'whk-itest-%'`;
  }

  async function withCleanDb(fn: () => Promise<void>): Promise<void> {
    await cleanupTestData();
    try {
      await fn();
    } finally {
      await cleanupTestData();
    }
  }

  async function entitlementRow(entitlementId = TEST_ENTITLEMENT) {
    const rows = await harness().owner<Record<string, any>[]>`
      SELECT * FROM public.entitlements
       WHERE app_user_id = ${TEST_APP_USER_ID} AND entitlement_id = ${entitlementId}`;
    if (rows.length !== 1) throw new Error(`expected one entitlement row, found ${rows.length}`);
    return rows[0]!;
  }

  async function ledgerCount(where: 'all' | 'itest'): Promise<number> {
    const owner = harness().owner;
    const [row] =
      where === 'all'
        ? await owner<{ n: number }[]>`SELECT count(*)::int AS n FROM public.webhook_events`
        : await owner<{ n: number }[]>`SELECT count(*)::int AS n FROM public.webhook_events WHERE event_id LIKE 'whk-itest-%'`;
    return row?.n ?? 0;
  }

  it('handler: signed grant event applies entitlement once with mapped supabase user', async () => {
    await withCleanDb(async () => {
      const expiresMs = Date.now() + 30 * DAY_MS;
      const res = await signed(
        eventJson({
          eventId: uniqueEventId(),
          type: 'INITIAL_PURCHASE',
          expirationAtMs: expiresMs,
          productId: 'cal_premium_monthly',
        }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true, applied: true });

      const row = await entitlementRow();
      expect(row.active).toBe(true);
      expect(new Date(row.expires_at).getTime()).toBe(expiresMs);
      expect(row.user_id).toBe(TEST_APP_USER_ID);
      expect(row.product_id).toBe('cal_premium_monthly');
    });
  });

  it('handler: redelivered event id returns applied false and leaves the row untouched', async () => {
    await withCleanDb(async () => {
      const eventId = uniqueEventId();
      const expiresMs = Date.now() + DAY_MS;
      const raw = eventJson({ eventId, type: 'INITIAL_PURCHASE', expirationAtMs: expiresMs });

      const first = await signed(raw);
      expect(((await first.json()) as { applied: boolean }).applied).toBe(true);
      const before = await entitlementRow();

      await sleep(50);
      const second = await signed(raw);
      expect(second.status).toBe(200);
      expect(((await second.json()) as { applied: boolean }).applied).toBe(false);

      const after = await entitlementRow();
      expect(after.updated_at).toEqual(before.updated_at);
      expect(after.expires_at).toEqual(before.expires_at);
    });
  });

  it('handler: a second distinct event updates the same row in place', async () => {
    await withCleanDb(async () => {
      const firstMs = Date.now() + DAY_MS;
      const secondMs = Date.now() + 60 * DAY_MS;
      await signed(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE', expirationAtMs: firstMs }));
      const before = await entitlementRow();

      const res = await signed(eventJson({ eventId: uniqueEventId(), type: 'RENEWAL', expirationAtMs: secondMs }));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { applied: boolean }).applied).toBe(true);

      const [count] = await harness().owner<{ n: number }[]>`
        SELECT count(*)::int AS n FROM public.entitlements WHERE app_user_id = ${TEST_APP_USER_ID}`;
      expect(count?.n).toBe(1);

      const after = await entitlementRow();
      expect(new Date(after.expires_at).getTime()).toBe(secondMs);
      expect(after.updated_at).not.toEqual(before.updated_at);
    });
  });

  it('handler: EXPIRATION revokes access', async () => {
    await withCleanDb(async () => {
      await signed(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE', expirationAtMs: Date.now() + DAY_MS }));
      const res = await signed(eventJson({ eventId: uniqueEventId(), type: 'EXPIRATION', expirationAtMs: Date.now() }));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { applied: boolean }).applied).toBe(true);
      expect((await entitlementRow()).active).toBe(false);
    });
  });

  it('handler: an older retried event cannot overwrite newer entitlement state', async () => {
    await withCleanDb(async () => {
      await signed(
        eventJson({
          eventId: uniqueEventId(),
          type: 'INITIAL_PURCHASE',
          expirationAtMs: Date.now() + DAY_MS,
          timestampMs: 2_000,
        }),
      );
      const before = await entitlementRow();
      expect(before.active).toBe(true);

      // A delayed EXPIRATION retry (older event, first delivery after the newer state was applied)
      // must not revoke newer state.
      const stale = await signed(eventJson({ eventId: uniqueEventId(), type: 'EXPIRATION', timestampMs: 1_000 }));
      expect(stale.status).toBe(200);
      expect(((await stale.json()) as { applied: boolean }).applied).toBe(false);
      const afterStale = await entitlementRow();
      expect(afterStale.active).toBe(true);
      expect(afterStale.expires_at).toEqual(before.expires_at);

      // A genuinely newer event still applies.
      const newer = await signed(eventJson({ eventId: uniqueEventId(), type: 'EXPIRATION', timestampMs: 3_000 }));
      expect(((await newer.json()) as { applied: boolean }).applied).toBe(true);
      expect((await entitlementRow()).active).toBe(false);
    });
  });

  it('handler: CANCELLATION keeps access active', async () => {
    await withCleanDb(async () => {
      await signed(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE', expirationAtMs: Date.now() + DAY_MS }));
      const periodEndMs = Date.now() + 12 * DAY_MS;
      const res = await signed(eventJson({ eventId: uniqueEventId(), type: 'CANCELLATION', expirationAtMs: periodEndMs }));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { applied: boolean }).applied).toBe(true);
      const row = await entitlementRow();
      expect(row.active).toBe(true);
      expect(new Date(row.expires_at).getTime()).toBe(periodEndMs);
    });
  });

  it('handler: unsigned request is rejected with 401 and zero writes', async () => {
    await withCleanDb(async () => {
      const ledgerBefore = await ledgerCount('all');
      const res = await send(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' }));
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_SIGNATURE');
      const ledgerAfter = await ledgerCount('all');
      expect(ledgerAfter).toBe(ledgerBefore);
      expect(await ledgerCount('itest')).toBe(0);
    });
  });

  it('handler: tampered body is rejected with 401 and zero writes', async () => {
    await withCleanDb(async () => {
      const raw = eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' });
      const tampered = raw.replace('INITIAL_PURCHASE', 'RENEWAL');
      const res = await send(tampered, { [SIGNATURE]: signHeader(raw) });
      expect(res.status).toBe(401);
      expect(await ledgerCount('itest')).toBe(0);
    });
  });

  it('handler: stale timestamp is rejected with 401', async () => {
    await withCleanDb(async () => {
      const stale = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS + 1);
      const res = await signed(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' }), TEST_SECRET, stale);
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_SIGNATURE');
    });
  });

  it('handler: signed but schema-invalid payload returns 400 with zero writes', async () => {
    await withCleanDb(async () => {
      const raw = JSON.stringify({
        event: { id: uniqueEventId(), type: 'TRANSFER', data: { app_user_id: TEST_APP_USER_ID } },
      });
      const res = await signed(raw);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
      expect(await ledgerCount('itest')).toBe(0);
    });
  });

  it('handler: signed malformed JSON returns 400', async () => {
    const res = await signed('{"event":');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('handler: multi-entitlement event writes each once; redelivery writes nothing', async () => {
    await withCleanDb(async () => {
      const eventId = uniqueEventId();
      const expiresMs = Date.now() + DAY_MS;
      const raw = eventJson({
        eventId,
        type: 'INITIAL_PURCHASE',
        entitlementIds: [TEST_ENTITLEMENT, 'bonus'],
        expirationAtMs: expiresMs,
      });
      const owner = harness().owner;
      const rowsOf = () =>
        owner<Record<string, any>[]>`
          SELECT * FROM public.entitlements WHERE app_user_id = ${TEST_APP_USER_ID} ORDER BY entitlement_id`;

      const first = await signed(raw);
      expect(first.status).toBe(200);
      expect(((await first.json()) as { applied: boolean }).applied).toBe(true);
      const rows = await rowsOf();
      expect(rows.length).toBe(2);

      await sleep(50);
      const second = await signed(raw);
      expect(((await second.json()) as { applied: boolean }).applied).toBe(false);
      const rowsAfter = await rowsOf();
      expect(rowsAfter.map((r) => r.updated_at)).toEqual(rows.map((r) => r.updated_at));
    });
  });

  it('handler: missing signing secret fails closed with 401', async () => {
    // The API refuses to start without RC_WEBHOOK_SIGNING_SECRET (config.test.ts); a route built with
    // an empty secret anyway must still reject, even a signature made with the empty key.
    const app = new Hono();
    registerWebhookRoute(app, { db: harness().db, secret: '' });
    const raw = eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' });
    for (const secret of [TEST_SECRET, '']) {
      const res = await app.request(WEBHOOK_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SIGNATURE]: signHeader(raw, secret) },
        body: raw,
      });
      expect(res.status).toBe(401);
    }
    expect(await ledgerCount('itest')).toBe(0);
  });
});
