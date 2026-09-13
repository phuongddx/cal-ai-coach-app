import { z } from 'npm:zod';

/**
 * RevenueCat webhook envelope — parsed only AFTER HMAC verification passes,
 * since the signature covers the exact raw body bytes. Mapping to the
 * apply_webhook_event RPC input follows the documented revocation policy:
 * only EXPIRATION revokes access; CANCELLATION and SUBSCRIPTION_PAUSED keep
 * access until the stated period end.
 */

export const RC_EVENT_TYPES = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'EXPIRATION',
  'CANCELLATION',
  'SUBSCRIPTION_PAUSED',
  'BILLING_ISSUE',
] as const;
export type RcEventType = (typeof RC_EVENT_TYPES)[number];

export const RcWebhookEnvelopeSchema = z.strictObject({
  event: z.strictObject({
    id: z.string().min(1),
    type: z.enum(RC_EVENT_TYPES),
    // Event time drives the out-of-order guard in apply_webhook_event;
    // absent on some payloads, in which case the event is ordered oldest.
    timestamp_ms: z.number().optional(),
    data: z.strictObject({
      app_user_id: z.string().min(1),
      entitlement_ids: z.array(z.string()).default([]),
      expiration_at_ms: z.number().nullable().optional(),
      product_id: z.string().nullable().optional(),
    }),
  }),
});
export type RcWebhookEnvelope = z.infer<typeof RcWebhookEnvelopeSchema>;

export type WebhookEventPolicy = 'grant' | 'revoke' | 'ledger-only';

const GRANT_TYPES: ReadonlySet<RcEventType> = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
]);

export function eventTypePolicy(type: RcEventType): WebhookEventPolicy {
  if (GRANT_TYPES.has(type)) return 'grant';
  if (type === 'EXPIRATION') return 'revoke';
  return 'ledger-only';
}

export type WebhookEventInput = {
  eventId: string;
  appUserId: string;
  entitlementId: string;
  active: boolean;
  expiresAt?: string;
  productId?: string;
  supabaseUserId?: string;
  timestampMs?: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toWebhookEvent(envelope: RcWebhookEnvelope): WebhookEventInput[] {
  const { id, type, timestamp_ms, data } = envelope.event;
  const active = eventTypePolicy(type) !== 'revoke';
  const expiresAt = data.expiration_at_ms == null
    ? undefined
    : new Date(data.expiration_at_ms).toISOString();
  const supabaseUserId = UUID_PATTERN.test(data.app_user_id) ? data.app_user_id : undefined;
  return data.entitlement_ids.map((entitlementId) => ({
    eventId: id,
    appUserId: data.app_user_id,
    entitlementId,
    active,
    expiresAt,
    productId: data.product_id ?? undefined,
    supabaseUserId,
    timestampMs: timestamp_ms,
  }));
}
