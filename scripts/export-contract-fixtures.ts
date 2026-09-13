/**
 * Golden-fixture exporter — contract values → JSON for the eval harness and
 * the Phase 3 Swift DTO fixtures. Every value is built through the real zod
 * contracts, kcal/macros are precomputed through the canonical arithmetic
 * module (Swift-parity values baked in), and every written file is re-read
 * and re-parsed against its contract before the process may exit 0.
 *
 * Output dir is overridable via SCAN_GOLDEN_OUTPUT_DIR. The default is
 * deliberately NOT the Swift native/.../Fixtures dir: GoldenFixtureTests
 * strict-decodes every .golden.json in there, so scan fixtures may only be
 * copied over in Phase 3 when the Swift DTOs exist.
 */
import { z } from 'npm:zod';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import {
  ScanRequestSchema,
  ScanResponseSchema,
  type ScanItemResponse,
  type ScanRequest,
  type ScanResponse,
} from '../supabase/functions/_shared/contracts/scan.ts';
import { ErrorEnvelopeSchema } from '../supabase/functions/_shared/contracts/errors.ts';
import { RcWebhookEnvelopeSchema } from '../supabase/functions/_shared/contracts/webhook.ts';
import { roundKcal, roundMacro, sumItemKcal } from '../supabase/functions/_shared/arithmetic.ts';

const OUTPUT_DIR = Deno.env.get('SCAN_GOLDEN_OUTPUT_DIR') ??
  'supabase/functions/tests/golden';

// Golden values are hand-pinned representatives; never derived from env so
// no secret-shaped value can reach the artifacts.
const PHOTO_SCAN_ID = 'aa000000-0000-4000-8000-000000000001';
const LABEL_SCAN_ID = 'aa000000-0000-4000-8000-000000000002';
const TEXT_SCAN_ID = 'aa000000-0000-4000-8000-000000000003';
const BARCODE_SCAN_ID = 'aa000000-0000-4000-8000-000000000004';

const CHICKEN_RICE_PER100G = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const CHICKEN_RICE_GRAMS = 320;

interface Fixture {
  name: string;
  value: unknown;
  contract: z.ZodType;
}

function scanItemFromGrounded(
  vlm: { label: string; grams: number; gramsBasis: 'estimated' | 'reference-object' | 'packaged-serving'; confidence: number; hiddenFatLikely: boolean },
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number },
): ScanItemResponse {
  return {
    label: vlm.label,
    grams: vlm.grams,
    gramsBasis: vlm.gramsBasis,
    confidence: vlm.confidence,
    hiddenFatLikely: vlm.hiddenFatLikely,
    source: 'cache',
    per100g,
    kcal: roundKcal(per100g.kcal, vlm.grams),
    proteinG: roundMacro(per100g.proteinG, vlm.grams),
    carbsG: roundMacro(per100g.carbsG, vlm.grams),
    fatG: roundMacro(per100g.fatG, vlm.grams),
    fiberG: roundMacro(per100g.fiberG, vlm.grams),
    unresolved: false,
  };
}

function fixtures(): Fixture[] {
  const photoRequest: ScanRequest = ScanRequestSchema.parse({
    scanId: PHOTO_SCAN_ID,
    kind: 'photo',
    mealType: 'lunch',
    imageBase64: 'fixture:chicken-rice',
  });
  const labelRequest: ScanRequest = ScanRequestSchema.parse({
    scanId: LABEL_SCAN_ID,
    kind: 'label',
    mealType: 'snack',
    imageBase64: 'fixture:nutrition-label',
  });
  const textRequest: ScanRequest = ScanRequestSchema.parse({
    scanId: TEXT_SCAN_ID,
    kind: 'text',
    mealType: 'dinner',
    textDescription: 'a grilled chicken breast with rice',
  });
  const barcodeRequest: ScanRequest = ScanRequestSchema.parse({
    scanId: BARCODE_SCAN_ID,
    kind: 'barcode',
    mealType: 'lunch',
    barcode: '3017620422003',
  });

  const photoResponse: ScanResponse = ScanResponseSchema.parse({
    scanId: PHOTO_SCAN_ID,
    kind: 'photo',
    items: [
      scanItemFromGrounded(
        {
          label: 'chicken-rice',
          grams: CHICKEN_RICE_GRAMS,
          gramsBasis: 'estimated',
          confidence: 0.92,
          hiddenFatLikely: false,
        },
        CHICKEN_RICE_PER100G,
      ),
    ],
    mealKcal: sumItemKcal([
      scanItemFromGrounded(
        {
          label: 'chicken-rice',
          grams: CHICKEN_RICE_GRAMS,
          gramsBasis: 'estimated',
          confidence: 0.92,
          hiddenFatLikely: false,
        },
        CHICKEN_RICE_PER100G,
      ),
    ]),
    scanConfidence: 0.92,
    note: null,
  });

  const freeLimitEnvelope = ErrorEnvelopeSchema.parse({
    error: {
      code: 'FREE_LIMIT_REACHED',
      entitlement: {
        tier: 'free',
        scansUsed: 3,
        scanLimit: 3,
        windowResetAt: '2026-09-21T10:00:00Z',
      },
    },
  });
  const barcodeNotFoundEnvelope = ErrorEnvelopeSchema.parse({
    error: {
      code: 'BARCODE_NOT_FOUND',
      details: ['no grounding source resolved this barcode'],
    },
  });
  const vlmSchemaErrorEnvelope = ErrorEnvelopeSchema.parse({
    error: {
      code: 'VLM_SCHEMA_ERROR',
      details: ['items.0'],
    },
  });

  const webhookGrantEvent = RcWebhookEnvelopeSchema.parse({
    event: {
      id: 'evt-golden-initial-purchase-0001',
      type: 'INITIAL_PURCHASE',
      data: {
        app_user_id: 'bf4c7ac2-1d3e-4a2b-9c1d-5e6f7a8b9c0d',
        entitlement_ids: ['coachcal_pro'],
        expiration_at_ms: 1798761600000,
        product_id: 'coachcal_pro_monthly',
      },
    },
  });
  const webhookResponseSchema = z.strictObject({
    received: z.literal(true),
    applied: z.boolean(),
  });
  const webhookResponse = webhookResponseSchema.parse({ received: true, applied: true });

  return [
    { name: 'scan-request-photo', value: photoRequest, contract: ScanRequestSchema },
    { name: 'scan-request-label', value: labelRequest, contract: ScanRequestSchema },
    { name: 'scan-request-text', value: textRequest, contract: ScanRequestSchema },
    { name: 'scan-request-barcode', value: barcodeRequest, contract: ScanRequestSchema },
    { name: 'scan-response-200', value: photoResponse, contract: ScanResponseSchema },
    { name: 'error-402-free-limit', value: freeLimitEnvelope, contract: ErrorEnvelopeSchema },
    {
      name: 'error-404-barcode-not-found',
      value: barcodeNotFoundEnvelope,
      contract: ErrorEnvelopeSchema,
    },
    { name: 'error-422-vlm-schema', value: vlmSchemaErrorEnvelope, contract: ErrorEnvelopeSchema },
    { name: 'webhook-grant-event', value: webhookGrantEvent, contract: RcWebhookEnvelopeSchema },
    { name: 'webhook-response-200', value: webhookResponse, contract: webhookResponseSchema },
  ];
}

function fail(message: string): never {
  console.error(`EXPORT FAILED: ${message}`);
  Deno.exit(1);
}

// Mirrors the measure-phase1-sync redaction posture: golden files are
// generated artifacts, so a sensitive-looking key or value must fail the
// export instead of landing in a committed file.
const SENSITIVE_PATTERN = /(password|secret|token|email|key|endpoint|url|header|auth|credential)/i;

function assertNoSensitiveContent(name: string, value: unknown): void {
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [k, v] of Object.entries(node)) {
        if (SENSITIVE_PATTERN.test(k)) fail(`${name}: sensitive key "${k}" at ${path}`);
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof node === 'string' && SENSITIVE_PATTERN.test(node)) {
      fail(`${name}: sensitive-looking value at ${path}`);
    }
  };
  walk(value, '$');
}

async function main(): Promise<void> {
  const fixturesToWrite = fixtures();
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const fixture of fixturesToWrite) {
    assertNoSensitiveContent(fixture.name, fixture.value);
    const destination = `${OUTPUT_DIR}/${fixture.name}.golden.json`;
    await writeFile(destination, `${JSON.stringify(fixture.value, null, 2)}\n`);

    // Round-trip proof: the written bytes must re-parse against the same
    // contract — drift here would silently poison Phase 3 codegen and eval.
    const raw = await readFile(destination, 'utf8');
    let reparsed: unknown;
    try {
      reparsed = JSON.parse(raw);
    } catch (error) {
      fail(`${fixture.name}: written file is not valid JSON (${error.message})`);
    }
    const parsed = fixture.contract.safeParse(reparsed);
    if (!parsed.success) {
      fail(`${fixture.name}: round-trip drift — ${parsed.error.message}`);
    }
    console.log(`exported ${fixture.name}.golden.json (round-trip ok)`);
  }

  const written = new Set((await readdir(OUTPUT_DIR)).filter((f) => f.endsWith('.golden.json')));
  for (const fixture of fixturesToWrite) {
    if (!written.has(`${fixture.name}.golden.json`)) {
      fail(`${fixture.name}: missing from output dir after export`);
    }
  }
}

if (import.meta.main) await main();
