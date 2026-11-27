/**
 * POST /webhooks/revenuecat: HMAC over the raw body, then the envelope schema, then one
 * `webhook_apply` call per entitlement. Not behind `requireUser`: the signature is the credential.
 *
 * Gate order (fixed, ported from the old function): signature (401 INVALID_SIGNATURE) -> JSON (400) ->
 * envelope schema (400) -> apply (500 INTERNAL on a database error).
 */
import {
  RcWebhookEnvelopeSchema,
  toWebhookEvent,
  type WebhookEventInput,
} from '@coachcal/api-contract';
import type { Hono } from 'hono';

import type { Db } from '../db';
import { json } from '../http';
import { callJson } from '../auth/sql';
import { verifyRcHmac } from './hmac';

export const SIGNATURE_HEADER = 'X-RevenueCat-Webhook-Signature';

export interface WebhookDeps {
  db: Db;
  secret: Buffer | string;
}

/**
 * The ONE place the contract's legacy field `supabaseUserId` (packages/api-contract, not changeable
 * here) becomes this API's `userId`. Nothing else in apps/api reads the legacy name.
 */
export function toApplyEvent(input: WebhookEventInput, ledgerEventId: string): Record<string, unknown> {
  const { supabaseUserId, ...rest } = input;
  return { ...rest, eventId: ledgerEventId, ...(supabaseUserId !== undefined ? { userId: supabaseUserId } : {}) };
}

export function registerWebhookRoute(app: Hono<any>, deps: WebhookDeps): void {
  app.post('/webhooks/revenuecat', async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header(SIGNATURE_HEADER);
    // An empty secret would make every HMAC computable by anyone: fail closed.
    if (deps.secret.length === 0 || !signature || !verifyRcHmac(raw, signature, deps.secret)) {
      return json(401, { error: { code: 'INVALID_SIGNATURE' } });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json(400, { error: { code: 'VALIDATION_ERROR' } });
    }
    const parsed = RcWebhookEnvelopeSchema.safeParse(payload);
    if (!parsed.success) return json(400, { error: { code: 'VALIDATION_ERROR' } });

    const inputs = toWebhookEvent(parsed.data);
    if (inputs.length === 0) return json(200, { received: true, applied: false });

    let applied = false;
    for (const [index, input] of inputs.entries()) {
      // apply_webhook_event couples ledger dedupe with a single-entitlement upsert, so entitlements
      // beyond the first use derived ledger keys to stay exactly-once under at-least-once retries.
      const ledgerEventId = index === 0 ? input.eventId : `${input.eventId}:${input.entitlementId}`;
      try {
        const result = await deps.db.withoutUser((query) =>
          callJson<{ applied?: boolean }>(query, `public.webhook_apply($1::jsonb)`, [toApplyEvent(input, ledgerEventId)]),
        );
        applied = applied || result?.applied === true;
      } catch (error) {
        console.error(`[api] webhook_apply failed: ${error instanceof Error ? error.message : 'error'}`);
        return json(500, { error: { code: 'INTERNAL' } });
      }
    }
    return json(200, { received: true, applied });
  });
}
