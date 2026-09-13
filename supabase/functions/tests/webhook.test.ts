import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
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
