import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handler } from '../rc-webhook/index.ts';
import {
  SIGNATURE_MAX_AGE_SECONDS,
  timingSafeHexEqual,
  verifyRcHmac,
} from '../_shared/webhook/hmac.ts';
import {
  RC_EVENT_TYPES,
  RcWebhookEnvelopeSchema,
  toWebhookEvent,
  eventTypePolicy,
  type RcEventType,
} from '../_shared/contracts/webhook.ts';

const TEST_SECRET = 'test-webhook-signing-secret';
const encoder = new TextEncoder();

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signHeader(
  raw: string,
  secret = TEST_SECRET,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<string> {
  const v1 = await hmacHex(`${timestamp}.${raw}`, secret);
  return `t=${timestamp},v1=${v1}`;
}

const rawBody = JSON.stringify({
  event: {
    id: 'evt_1',
    type: 'RENEWAL',
    data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
  },
});

Deno.test('hmac: a valid t/v1 signature over the exact raw body verifies', async () => {
  assert(await verifyRcHmac(rawBody, await signHeader(rawBody), TEST_SECRET));
});

Deno.test('hmac: one altered body byte fails', async () => {
  const tampered = rawBody.replace('evt_1', 'evt_2');
  assert(tampered !== rawBody);
  assert(!await verifyRcHmac(tampered, await signHeader(rawBody), TEST_SECRET));
});

Deno.test('hmac: a v1 from a different secret fails', async () => {
  assert(!await verifyRcHmac(rawBody, await signHeader(rawBody, 'another-secret'), TEST_SECRET));
});

Deno.test('hmac: a timestamp 301 seconds old fails', async () => {
  const stale = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS + 1);
  assert(!await verifyRcHmac(rawBody, await signHeader(rawBody, TEST_SECRET, stale), TEST_SECRET));
});

Deno.test('hmac: a timestamp 299 seconds old passes', async () => {
  const recent = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS - 1);
  assert(await verifyRcHmac(rawBody, await signHeader(rawBody, TEST_SECRET, recent), TEST_SECRET));
});

Deno.test('hmac: a future timestamp beyond tolerance fails', async () => {
  const future = Math.floor(Date.now() / 1000) + SIGNATURE_MAX_AGE_SECONDS + 1;
  assert(!await verifyRcHmac(rawBody, await signHeader(rawBody, TEST_SECRET, future), TEST_SECRET));
});

Deno.test('hmac: malformed headers fail', async () => {
  const futureProofV1 = await hmacHex(`${Math.floor(Date.now() / 1000)}.${rawBody}`, TEST_SECRET);
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
    assert(!await verifyRcHmac(rawBody, header, TEST_SECRET), `expected reject: "${header}"`);
  }
});

Deno.test('hmac: timingSafeHexEqual ab00 vs ab01 is false', () => {
  assert(!timingSafeHexEqual('ab00', 'ab01'));
});

Deno.test('hmac: timingSafeHexEqual compares equal-length inputs in full', () => {
  assert(timingSafeHexEqual('abcdef01', 'abcdef01'));
  assert(!timingSafeHexEqual('abcdef01', 'abcdef02'));
});

Deno.test('hmac: timingSafeHexEqual never matches different lengths', () => {
  assert(!timingSafeHexEqual('abc', 'abcd'));
  assert(!timingSafeHexEqual('', 'a'));
});

const validEnvelope = {
  event: {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
  },
};

Deno.test('RcWebhookEnvelopeSchema accepts a valid envelope and defaults entitlement_ids', () => {
  const parsed = RcWebhookEnvelopeSchema.parse({
    event: { id: 'evt_1', type: 'INITIAL_PURCHASE', data: { app_user_id: 'user-1' } },
  });
  assertEquals(parsed.event.data.entitlement_ids, []);
});

Deno.test('RcWebhookEnvelopeSchema rejects unknown keys at every level', () => {
  const extraData = structuredClone(validEnvelope);
  (extraData.event.data as Record<string, unknown>).kcal = 100;
  assertThrows(() => RcWebhookEnvelopeSchema.parse(extraData));

  const extraEvent = structuredClone(validEnvelope);
  (extraEvent.event as Record<string, unknown>).source = 'revenuecat';
  assertThrows(() => RcWebhookEnvelopeSchema.parse(extraEvent));

  const extraTop = { ...validEnvelope, mode: 'malformed' };
  assertThrows(() => RcWebhookEnvelopeSchema.parse(extraTop));
});

Deno.test('RcWebhookEnvelopeSchema rejects an unknown event type', () => {
  assertThrows(() =>
    RcWebhookEnvelopeSchema.parse({
      event: { id: 'evt_1', type: 'TRANSFER', data: { app_user_id: 'user-1' } },
    })
  );
});

Deno.test('eventTypePolicy classifies all nine event types', () => {
  const grants = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED'];
  for (const type of grants) {
    assertEquals(eventTypePolicy(type as RcEventType), 'grant', type);
  }
  assertEquals(eventTypePolicy('EXPIRATION'), 'revoke');
  for (const type of ['CANCELLATION', 'SUBSCRIPTION_PAUSED', 'BILLING_ISSUE']) {
    assertEquals(eventTypePolicy(type as RcEventType), 'ledger-only', type);
  }
  assertEquals(RC_EVENT_TYPES.length, 9);
});

Deno.test('toWebhookEvent keeps access active for every type except EXPIRATION', () => {
  for (const type of RC_EVENT_TYPES) {
    const inputs = toWebhookEvent({
      event: { id: 'evt_1', type, data: { app_user_id: 'user-1', entitlement_ids: ['premium'] } },
    });
    assertEquals(inputs.length, 1, type);
    assertEquals(inputs[0].active, type !== 'EXPIRATION', type);
  }
});

Deno.test('toWebhookEvent maps expiration_at_ms to canonical ISO and omits when absent', () => {
  const withExpiry = toWebhookEvent({
    event: {
      id: 'evt_1',
      type: 'RENEWAL',
      data: { app_user_id: 'user-1', entitlement_ids: ['premium'], expiration_at_ms: 1798761600123 },
    },
  });
  assertEquals(withExpiry[0].expiresAt, new Date(1798761600123).toISOString());

  const withoutExpiry = toWebhookEvent({
    event: {
      id: 'evt_2',
      type: 'RENEWAL',
      data: { app_user_id: 'user-1', entitlement_ids: ['premium'], expiration_at_ms: null },
    },
  });
  assertEquals(withoutExpiry[0].expiresAt, undefined);
});

Deno.test('RcWebhookEnvelopeSchema accepts event.timestamp_ms and toWebhookEvent forwards it', () => {
  const parsed = RcWebhookEnvelopeSchema.parse({
    event: {
      id: 'evt_1',
      type: 'RENEWAL',
      timestamp_ms: 1_700_000_000_000,
      data: { app_user_id: 'user-1', entitlement_ids: ['premium'] },
    },
  });
  assertEquals(parsed.event.timestamp_ms, 1_700_000_000_000);
  const [input] = toWebhookEvent(parsed);
  assertEquals(input.timestampMs, 1_700_000_000_000);

  const without = toWebhookEvent({
    event: { id: 'evt_2', type: 'RENEWAL', data: { app_user_id: 'user-1', entitlement_ids: ['premium'] } },
  });
  assertEquals(without[0].timestampMs, undefined);
});

Deno.test('toWebhookEvent produces one RPC input per entitlement id', () => {
  const inputs = toWebhookEvent({
    event: {
      id: 'evt_1',
      type: 'INITIAL_PURCHASE',
      data: { app_user_id: 'user-1', entitlement_ids: ['premium', 'bonus'] },
    },
  });
  assertEquals(inputs.length, 2);
  assertEquals(inputs.map((i) => i.entitlementId), ['premium', 'bonus']);
  assertEquals(new Set(inputs.map((i) => i.eventId)).size, 1);
  assertEquals(new Set(inputs.map((i) => i.appUserId)).size, 1);
});

Deno.test('toWebhookEvent maps a uuid app_user_id to supabaseUserId, omits otherwise', () => {
  const uuid = '11111111-2222-4333-8444-555555555555';
  const mapped = toWebhookEvent({
    event: { id: 'evt_1', type: 'RENEWAL', data: { app_user_id: uuid, entitlement_ids: ['premium'] } },
  });
  assertEquals(mapped[0].supabaseUserId, uuid);

  const unmapped = toWebhookEvent({
    event: {
      id: 'evt_2',
      type: 'RENEWAL',
      data: { app_user_id: '$RCAnonymousID:abc123', entitlement_ids: ['premium'] },
    },
  });
  assertEquals(unmapped[0].supabaseUserId, undefined);
});

Deno.test('toWebhookEvent passes product_id through and omits null', () => {
  const withProduct = toWebhookEvent({
    event: {
      id: 'evt_1',
      type: 'RENEWAL',
      data: { app_user_id: 'user-1', entitlement_ids: ['premium'], product_id: 'cal_premium_monthly' },
    },
  });
  assertEquals(withProduct[0].productId, 'cal_premium_monthly');

  const withoutProduct = toWebhookEvent({
    event: {
      id: 'evt_2',
      type: 'RENEWAL',
      data: { app_user_id: 'user-1', entitlement_ids: ['premium'], product_id: null },
    },
  });
  assertEquals(withoutProduct[0].productId, undefined);
});

// Handler tests run against the local stack env (--env-file from supabase status).
Deno.env.set('RC_WEBHOOK_SIGNING_SECRET', TEST_SECRET);

const TEST_APP_USER_ID = '11111111-2222-4333-8444-555555555555';
const TEST_ENTITLEMENT = 'premium';
const DAY_MS = 24 * 60 * 60 * 1000;

let testServiceClient: SupabaseClient | null = null;

function serviceClientForTests(): SupabaseClient {
  if (testServiceClient) return testServiceClient;
  // Local `supabase status -o env` emits API_URL/SERVICE_ROLE_KEY; alias them
  // to the platform-injected names the handler reads so --env-file runs work.
  if (!Deno.env.get('SUPABASE_URL') && Deno.env.get('API_URL')) {
    Deno.env.set('SUPABASE_URL', Deno.env.get('API_URL')!);
  }
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') && Deno.env.get('SERVICE_ROLE_KEY')) {
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SERVICE_ROLE_KEY')!);
  }
  const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('API_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL/API_URL and SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY must be set for handler tests',
    );
  }
  testServiceClient = createClient(url, key, { auth: { persistSession: false } });
  return testServiceClient;
}

function uniqueEventId(): string {
  return `whk-itest-${crypto.randomUUID()}`;
}

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

function webhookRequest(raw: string, headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/rc-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: raw,
  });
}

async function signedRequest(
  raw: string,
  secret = TEST_SECRET,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<Request> {
  return webhookRequest(raw, {
    'X-RevenueCat-Webhook-Signature': await signHeader(raw, secret, timestamp),
  });
}

async function cleanupTestData(): Promise<void> {
  const db = serviceClientForTests();
  await db.from('entitlements').delete().eq('app_user_id', TEST_APP_USER_ID);
  await db.from('webhook_events').delete().like('event_id', 'whk-itest-%');
}

async function withCleanDb(fn: () => Promise<void>): Promise<void> {
  await cleanupTestData();
  try {
    await fn();
  } finally {
    await cleanupTestData();
  }
}

async function entitlementRow() {
  const { data, error } = await serviceClientForTests()
    .from('entitlements')
    .select('*')
    .eq('app_user_id', TEST_APP_USER_ID)
    .eq('entitlement_id', TEST_ENTITLEMENT)
    .single();
  if (error) throw error;
  return data;
}

Deno.test('handler: signed grant event applies entitlement once with mapped supabase user', async () => {
  await withCleanDb(async () => {
    const expiresMs = Date.now() + 30 * DAY_MS;
    const res = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'INITIAL_PURCHASE',
        expirationAtMs: expiresMs,
        productId: 'cal_premium_monthly',
      })),
    );
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { received: true, applied: true });

    const row = await entitlementRow();
    assertEquals(row.active, true);
    assertEquals(new Date(row.expires_at).getTime(), expiresMs);
    assertEquals(row.supabase_user_id, TEST_APP_USER_ID);
    assertEquals(row.product_id, 'cal_premium_monthly');
  });
});

Deno.test('handler: redelivered event id returns applied false and leaves the row untouched', async () => {
  await withCleanDb(async () => {
    const eventId = uniqueEventId();
    const expiresMs = Date.now() + DAY_MS;
    const raw = eventJson({ eventId, type: 'INITIAL_PURCHASE', expirationAtMs: expiresMs });

    const first = await handler(await signedRequest(raw));
    assertEquals((await first.json()).applied, true);
    const before = await entitlementRow();

    await new Promise((r) => setTimeout(r, 50));
    const second = await handler(await signedRequest(raw));
    assertEquals(second.status, 200);
    assertEquals((await second.json()).applied, false);

    const after = await entitlementRow();
    assertEquals(after.updated_at, before.updated_at);
    assertEquals(after.expires_at, before.expires_at);
  });
});

Deno.test('handler: a second distinct event updates the same row in place', async () => {
  await withCleanDb(async () => {
    const firstMs = Date.now() + DAY_MS;
    const secondMs = Date.now() + 60 * DAY_MS;
    await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'INITIAL_PURCHASE',
        expirationAtMs: firstMs,
      })),
    );
    const before = await entitlementRow();

    const res = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'RENEWAL',
        expirationAtMs: secondMs,
      })),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, true);

    const db = serviceClientForTests();
    const { count } = await db.from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('app_user_id', TEST_APP_USER_ID);
    assertEquals(count, 1);

    const after = await entitlementRow();
    assertEquals(new Date(after.expires_at).getTime(), secondMs);
    assert(after.updated_at !== before.updated_at);
  });
});

Deno.test('handler: EXPIRATION revokes access', async () => {
  await withCleanDb(async () => {
    await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'INITIAL_PURCHASE',
        expirationAtMs: Date.now() + DAY_MS,
      })),
    );
    const res = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'EXPIRATION',
        expirationAtMs: Date.now(),
      })),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, true);
    assertEquals((await entitlementRow()).active, false);
  });
});

Deno.test('handler: an older retried event cannot overwrite newer entitlement state', async () => {
  await withCleanDb(async () => {
    await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'INITIAL_PURCHASE',
        expirationAtMs: Date.now() + DAY_MS,
        timestampMs: 2_000,
      })),
    );
    const before = await entitlementRow();
    assertEquals(before.active, true);

    // A delayed EXPIRATION retry (older event, first delivery after the
    // newer state was applied) must not revoke newer state.
    const stale = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'EXPIRATION',
        timestampMs: 1_000,
      })),
    );
    assertEquals(stale.status, 200);
    assertEquals((await stale.json()).applied, false);
    const afterStale = await entitlementRow();
    assertEquals(afterStale.active, true);
    assertEquals(afterStale.expires_at, before.expires_at);

    // A genuinely newer event still applies.
    const newer = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'EXPIRATION',
        timestampMs: 3_000,
      })),
    );
    assertEquals((await newer.json()).applied, true);
    assertEquals((await entitlementRow()).active, false);
  });
});

Deno.test('handler: CANCELLATION keeps access active', async () => {
  await withCleanDb(async () => {
    await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'INITIAL_PURCHASE',
        expirationAtMs: Date.now() + DAY_MS,
      })),
    );
    const periodEndMs = Date.now() + 12 * DAY_MS;
    const res = await handler(
      await signedRequest(eventJson({
        eventId: uniqueEventId(),
        type: 'CANCELLATION',
        expirationAtMs: periodEndMs,
      })),
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).applied, true);
    const row = await entitlementRow();
    assertEquals(row.active, true);
    assertEquals(new Date(row.expires_at).getTime(), periodEndMs);
  });
});

Deno.test('handler: unsigned request is rejected with 401 and zero writes', async () => {
  await withCleanDb(async () => {
    const db = serviceClientForTests();
    const { count: ledgerBefore } = await db.from('webhook_events')
      .select('*', { count: 'exact', head: true });
    const res = await handler(webhookRequest(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' })));
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, 'INVALID_SIGNATURE');
    const { count: ledgerAfter } = await db.from('webhook_events')
      .select('*', { count: 'exact', head: true });
    assertEquals(ledgerAfter, ledgerBefore);
    assertEquals(ledgerAfter, 0);
  });
});

Deno.test('handler: tampered body is rejected with 401 and zero writes', async () => {
  await withCleanDb(async () => {
    const raw = eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' });
    const tampered = raw.replace('INITIAL_PURCHASE', 'RENEWAL');
    const res = await handler(webhookRequest(tampered, {
      'X-RevenueCat-Webhook-Signature': await signHeader(raw),
    }));
    assertEquals(res.status, 401);
    const { count } = await serviceClientForTests()
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .like('event_id', 'whk-itest-%');
    assertEquals(count, 0);
  });
});

Deno.test('handler: stale timestamp is rejected with 401', async () => {
  await withCleanDb(async () => {
    const stale = Math.floor(Date.now() / 1000) - (SIGNATURE_MAX_AGE_SECONDS + 1);
    const res = await handler(
      await signedRequest(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' }), TEST_SECRET, stale),
    );
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, 'INVALID_SIGNATURE');
  });
});

Deno.test('handler: signed but schema-invalid payload returns 400 with zero writes', async () => {
  await withCleanDb(async () => {
    const raw = JSON.stringify({
      event: { id: uniqueEventId(), type: 'TRANSFER', data: { app_user_id: TEST_APP_USER_ID } },
    });
    const res = await handler(await signedRequest(raw));
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error.code, 'VALIDATION_ERROR');
    const { count } = await serviceClientForTests()
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .like('event_id', 'whk-itest-%');
    assertEquals(count, 0);
  });
});

Deno.test('handler: signed malformed JSON returns 400', async () => {
  const res = await handler(await signedRequest('{"event":'));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error.code, 'VALIDATION_ERROR');
});

Deno.test('handler: multi-entitlement event writes each once; redelivery writes nothing', async () => {
  await withCleanDb(async () => {
    const db = serviceClientForTests();
    const eventId = uniqueEventId();
    const expiresMs = Date.now() + DAY_MS;
    const raw = eventJson({
      eventId,
      type: 'INITIAL_PURCHASE',
      entitlementIds: [TEST_ENTITLEMENT, 'bonus'],
      expirationAtMs: expiresMs,
    });

    const first = await handler(await signedRequest(raw));
    assertEquals(first.status, 200);
    assertEquals((await first.json()).applied, true);
    const { data: rows } = await db.from('entitlements')
      .select('*')
      .eq('app_user_id', TEST_APP_USER_ID)
      .order('entitlement_id');
    assertEquals(rows?.length, 2);

    await new Promise((r) => setTimeout(r, 50));
    const second = await handler(await signedRequest(raw));
    assertEquals((await second.json()).applied, false);
    const { data: rowsAfter } = await db.from('entitlements')
      .select('*')
      .eq('app_user_id', TEST_APP_USER_ID)
      .order('entitlement_id');
    assertEquals(rowsAfter?.map((r) => r.updated_at), rows?.map((r) => r.updated_at));
  });
});

Deno.test('handler: missing signing secret fails closed with 401', async () => {
  const saved = Deno.env.get('RC_WEBHOOK_SIGNING_SECRET');
  Deno.env.delete('RC_WEBHOOK_SIGNING_SECRET');
  try {
    const res = await handler(
      await signedRequest(eventJson({ eventId: uniqueEventId(), type: 'INITIAL_PURCHASE' })),
    );
    assertEquals(res.status, 401);
  } finally {
    if (saved !== undefined) Deno.env.set('RC_WEBHOOK_SIGNING_SECRET', saved);
  }
});
