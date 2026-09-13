import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { RcWebhookEnvelopeSchema, toWebhookEvent } from '../_shared/contracts/webhook.ts';
import { verifyRcHmac } from '../_shared/webhook/hmac.ts';

const SIGNATURE_HEADER = 'X-RevenueCat-Webhook-Signature';

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  return serviceClient;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handler(req: Request): Promise<Response> {
  const raw = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const secret = Deno.env.get('RC_WEBHOOK_SIGNING_SECRET');
  if (!signature || !secret || !(await verifyRcHmac(raw, signature, secret))) {
    return jsonResponse(401, { error: { code: 'INVALID_SIGNATURE' } });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: { code: 'VALIDATION_ERROR' } });
  }

  const parsed = RcWebhookEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(400, { error: { code: 'VALIDATION_ERROR' } });
  }

  const inputs = toWebhookEvent(parsed.data);
  if (inputs.length === 0) {
    return jsonResponse(200, { received: true, applied: false });
  }

  let applied = false;
  for (const [index, input] of inputs.entries()) {
    // apply_webhook_event couples ledger dedupe with a single-entitlement
    // upsert, so entitlements beyond the first use derived ledger keys to
    // stay exactly-once under RevenueCat's at-least-once retries.
    const ledgerEventId = index === 0 ? input.eventId : `${input.eventId}:${input.entitlementId}`;
    const { data, error } = await getServiceClient().rpc('apply_webhook_event', {
      p_event: { ...input, eventId: ledgerEventId },
    });
    if (error) return jsonResponse(500, { error: { code: 'INTERNAL' } });
    applied = applied || data?.applied === true;
  }
  return jsonResponse(200, { received: true, applied });
}

if (import.meta.main) Deno.serve(handler);
