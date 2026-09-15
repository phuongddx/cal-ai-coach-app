/**
 * Golden-set eval harness — drives the real pipeline pieces (fixture VLM via
 * the provider seam, the cache-grounding cascade, canonical arithmetic)
 * against the golden-dir cases and enforces the product bounds:
 *
 *   TIER1_RESOLUTION_TARGET = 0.85  (≥85% of scans resolve at Tier 1)
 *   P95_LATENCY_MAX_MS      = 1200  (fixture latency budget feeding the
 *                                   Phase 3 <5s UX math)
 *
 * Both bounds are calibrated against the deterministic FIXTURE's fixed
 * sentinel latencies (400-900ms) and fixed sentinel outputs (Pitfall 8) —
 * they say nothing about the real Gemini model. getVlmProvider() (the
 * existing seam) already routes to GeminiProvider when VLM_PROVIDER=gemini,
 * so LIVE_MODE below only changes what this harness asserts/prints, never
 * which provider drives a case:
 *
 *   - Fixture mode (default, or GEMINI_API_KEY absent): unchanged —
 *     per-case exact-match assertions against golden JSON, both bounds
 *     enforced as a hard CI gate.
 *   - Live mode (VLM_PROVIDER=gemini AND GEMINI_API_KEY present): per-case
 *     exact-match assertions are skipped (a real model never reproduces the
 *     fixture's sentinel items/kcal byte-for-byte); the measured Tier-1 rate
 *     and p95 are printed as OBSERVED values for manual promotion into the
 *     two constants above — never silently compared against them. See
 *     tests/golden/README.md for the promotion procedure.
 *
 * Cases are upserted into eval_cases (idempotent by case id) so the live
 * Phase 4 flip re-runs this same harness against the real model. Output is
 * passed through a redaction scan (ported from scripts/measure-phase1-sync.mjs)
 * before printing.
 *
 * Run: supabase status -o env > <envfile> && deno run --env-file=<envfile> --allow-all scripts/run-golden-eval.ts
 * Live: … VLM_PROVIDER=gemini GEMINI_API_KEY=... deno run --env-file=<envfile> --allow-all scripts/run-golden-eval.ts
 */
import { assertEquals } from 'jsr:@std/assert';
import { stackEnv } from '../supabase/functions/tests/_env.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  ScanRequestSchema,
  ScanResponseSchema,
  type ScanItemResponse,
  type ScanRequest,
  type ScanResponse,
} from '../supabase/functions/_shared/contracts/scan.ts';
import type { Per100g } from '../supabase/functions/_shared/contracts/scan.ts';
import { roundKcal, roundMacro, sumItemKcal } from '../supabase/functions/_shared/arithmetic.ts';
import { resolveBarcode, resolveFood } from '../supabase/functions/_shared/grounding/cascade.ts';
import { flagHiddenFat } from '../supabase/functions/_shared/hiddenFat.ts';
import { chooseTier } from '../supabase/functions/_shared/routing.ts';
import { getVlmProvider, overrideVlmProvider } from '../supabase/functions/_shared/vlm/provider.ts';
import { FixtureProvider } from '../supabase/functions/_shared/vlm/fixture.ts';
import { VlmOutputSchema } from '../supabase/functions/_shared/contracts/vlm.ts';

const TIER1_RESOLUTION_TARGET = 0.85;
const P95_LATENCY_MAX_MS = 1200;
// Live mode only changes what this harness asserts/prints (see header
// comment) — the provider itself is already selected by the existing
// getVlmProvider() seam.
const LIVE_MODE = Deno.env.get('VLM_PROVIDER') === 'gemini' &&
  Boolean(Deno.env.get('GEMINI_API_KEY'));
// A VLM_PROVIDER=gemini request without a key must never reach GeminiProvider
// and its guaranteed-to-fail live call (empty key → non-OK → UpstreamError) —
// degrade gracefully to the deterministic fixture instead of failing closed.
// Uses the existing test-only override seam; provider.ts's own env-based
// selection (Pitfall 7's one switch point) is untouched.
if (Deno.env.get('VLM_PROVIDER') === 'gemini' && !Deno.env.get('GEMINI_API_KEY')) {
  overrideVlmProvider(new FixtureProvider());
}

const GOLDEN_DIR = new URL('../supabase/functions/tests/golden/', import.meta.url);
const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_PER100G: Per100g = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  Deno.exit(1);
}

// Redaction scan (measure-phase1-sync.mjs posture): nothing reaches the
// terminal without passing it — a secret-shaped value in a report is a
// disclosed secret, so the run fails closed.
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|email|key|endpoint|url|header|auth|credential)/i;
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{15,}/, // JWT-shaped
  /\b[0-9a-f]{40,}\b/, // long hex (keys, digests)
];

function emit(line: string): void {
  if (SENSITIVE_KEY_PATTERN.test(line)) {
    fail(`redaction scan: output line carries a sensitive key name: ${line}`);
  }
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(line)) {
      fail('redaction scan: output line carries a secret-shaped value');
    }
  }
  console.log(line);
}

interface CaseExpectation {
  kind: ScanRequest['kind'];
  items: ScanItemResponse[];
  mealKcal: number;
  scanConfidence: number;
  note: string | null;
}

interface EvalCase {
  id: string;
  request: ScanRequest;
  expectedTier: 'tier1' | 'tier2';
  expected: CaseExpectation;
}

interface CaseOutcome {
  tier: 'tier1' | 'tier2';
  response: Omit<ScanResponse, 'scanId'>;
  latencyMs: number;
}

async function readGoldenRequest(name: string): Promise<ScanRequest> {
  const path = new URL(`${name}.golden.json`, GOLDEN_DIR);
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch {
    fail(`golden request ${name}.golden.json is missing — run scripts/export-contract-fixtures.ts first`);
  }
  const parsed = ScanRequestSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    fail(`golden request ${name}.golden.json does not parse against ScanRequestSchema: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function readGoldenResponse(): Promise<ScanResponse> {
  const path = new URL('scan-response-200.golden.json', GOLDEN_DIR);
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch {
    fail('golden response scan-response-200.golden.json is missing — run scripts/export-contract-fixtures.ts first');
  }
  const parsed = ScanResponseSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    fail(`scan-response-200.golden.json does not parse against ScanResponseSchema: ${parsed.error.message}`);
  }
  return parsed.data;
}

function groundedItem(
  label: string,
  grams: number,
  gramsBasis: 'estimated' | 'reference-object' | 'packaged-serving',
  confidence: number,
  hiddenFatLikely: boolean,
  per100g: Per100g,
): ScanItemResponse {
  return {
    label,
    grams,
    gramsBasis,
    confidence,
    hiddenFatLikely,
    source: 'cache',
    per100g,
    kcal: roundKcal(per100g.kcal, grams),
    proteinG: roundMacro(per100g.proteinG, grams),
    carbsG: roundMacro(per100g.carbsG, grams),
    fatG: roundMacro(per100g.fatG, grams),
    fiberG: roundMacro(per100g.fiberG, grams),
    unresolved: false,
  };
}

function unresolvedItem(
  label: string,
  grams: number,
  gramsBasis: 'estimated' | 'reference-object' | 'packaged-serving',
  confidence: number,
  hiddenFatLikely: boolean,
): ScanItemResponse {
  return {
    label,
    grams,
    gramsBasis,
    confidence,
    hiddenFatLikely,
    source: 'none',
    per100g: EMPTY_PER100G,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    unresolved: true,
  };
}

const CHICKEN_RICE: Per100g = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const PROTEIN_BAR: Per100g = { kcal: 400, proteinG: 30, carbsG: 40, fatG: 15, fiberG: 8 };
const CAESAR_SALAD: Per100g = { kcal: 190, proteinG: 9, carbsG: 11, fatG: 14, fiberG: 3 };
const GREEK_SALAD: Per100g = { kcal: 120, proteinG: 6, carbsG: 8, fatG: 8, fiberG: 2 };
const BANANA: Per100g = { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 };
const GREEK_YOGURT: Per100g = { kcal: 59, proteinG: 10.2, carbsG: 3.6, fatG: 0.4, fiberG: 0 };
const GRILLED_CHICKEN: Per100g = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 };
const NUTELLA_BARCODE: Per100g = { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 };

// Fixture-provider outputs are sentinel-keyed and frozen (02-03), and the
// cache seeds below pin the cascade inputs, so these expectations are stable
// literals — the same values plans 02-03/02-07 pinned in their suites.
async function evalCases(): Promise<EvalCase[]> {
  const photo = await readGoldenRequest('scan-request-photo');
  const label = await readGoldenRequest('scan-request-label');
  const text = await readGoldenRequest('scan-request-text');
  const barcode = await readGoldenRequest('scan-request-barcode');
  const photoResponse = await readGoldenResponse();
  const { scanId: _photoScanId, ...photoExpectation } = photoResponse;

  const caesarRequest: ScanRequest = ScanRequestSchema.parse({
    ...photo,
    imageBase64: 'fixture:caesar-salad',
  });
  const escalateRequest: ScanRequest = ScanRequestSchema.parse({
    ...photo,
    imageBase64: 'fixture:escalate-photo',
  });
  const bananaYogurtRequest: ScanRequest = ScanRequestSchema.parse({
    ...text,
    textDescription: 'grilled chicken breast',
  });
  const grilledChickenRequest: ScanRequest = ScanRequestSchema.parse({
    ...text,
    textDescription: 'greek salad',
  });

  return [
    {
      id: 'scan-request-photo',
      request: photo,
      expectedTier: 'tier1',
      expected: photoExpectation,
    },
    {
      id: 'scan-request-label',
      request: label,
      expectedTier: 'tier1',
      expected: {
        kind: 'label',
        items: [
          groundedItem('protein bar', 60, 'packaged-serving', 0.9, false, PROTEIN_BAR),
          unresolvedItem('roasted almonds', 15, 'packaged-serving', 0.6, false),
        ],
        mealKcal: 240,
        scanConfidence: 0.9,
        note: null,
      },
    },
    {
      id: 'scan-request-text',
      request: text,
      expectedTier: 'tier1',
      expected: {
        kind: 'text',
        items: [groundedItem('greek salad', 300, 'estimated', 0.8, false, GREEK_SALAD)],
        mealKcal: 360,
        scanConfidence: 0.8,
        note: null,
      },
    },
    {
      id: 'scan-request-barcode',
      request: barcode,
      expectedTier: 'tier1',
      expected: {
        kind: 'barcode',
        items: [
          groundedItem('barcode:3017620422003', 100, 'packaged-serving', 1, false, NUTELLA_BARCODE),
        ],
        mealKcal: 539,
        scanConfidence: 1,
        note: null,
      },
    },
    {
      id: 'derived-photo-caesar-salad',
      request: caesarRequest,
      expectedTier: 'tier1',
      expected: {
        kind: 'photo',
        items: [groundedItem('caesar salad', 250, 'estimated', 0.88, true, CAESAR_SALAD)],
        mealKcal: 475,
        scanConfidence: 0.88,
        note: null,
      },
    },
    {
      id: 'derived-photo-escalate',
      request: escalateRequest,
      expectedTier: 'tier2',
      expected: {
        kind: 'photo',
        items: [groundedItem('chicken-rice', 320, 'estimated', 0.92, false, CHICKEN_RICE)],
        mealKcal: 464,
        scanConfidence: 0.95,
        note: 'tier2 escalation',
      },
    },
    {
      id: 'derived-text-banana-yogurt',
      request: bananaYogurtRequest,
      expectedTier: 'tier1',
      expected: {
        kind: 'text',
        items: [
          groundedItem('banana', 118, 'estimated', 0.75, false, BANANA),
          groundedItem('greek yogurt', 170, 'estimated', 0.7, false, GREEK_YOGURT),
        ],
        mealKcal: 205,
        scanConfidence: 0.75,
        note: null,
      },
    },
    {
      id: 'derived-text-grilled-chicken',
      request: grilledChickenRequest,
      expectedTier: 'tier1',
      expected: {
        kind: 'text',
        items: [groundedItem('grilled chicken', 200, 'estimated', 0.85, false, GRILLED_CHICKEN)],
        mealKcal: 330,
        scanConfidence: 0.85,
        note: null,
      },
    },
  ];
}

const CACHE_SEEDS: ReadonlyArray<{ key: string; per100g?: Per100g; negative?: boolean }> = [
  { key: 'search:chicken-rice', per100g: CHICKEN_RICE },
  { key: 'search:protein bar', per100g: PROTEIN_BAR },
  { key: 'search:roasted almonds', negative: true },
  { key: 'search:caesar salad', per100g: CAESAR_SALAD },
  { key: 'search:greek salad', per100g: GREEK_SALAD },
  { key: 'search:banana', per100g: BANANA },
  { key: 'search:greek yogurt', per100g: GREEK_YOGURT },
  { key: 'search:grilled chicken', per100g: GRILLED_CHICKEN },
  { key: 'barcode:3017620422003', per100g: NUTELLA_BARCODE },
];

async function seedCache(service: SupabaseClient): Promise<void> {
  for (const seed of CACHE_SEEDS) {
    const { error } = await service.from('food_cache').upsert({
      cache_key: seed.key,
      source: seed.negative ? 'negative' : 'fdc',
      payload: seed.negative ? { notFound: true } : seed.per100g,
      expires_at: new Date(Date.now() + (seed.negative ? DAY_MS : 30 * DAY_MS)).toISOString(),
    });
    if (error) fail(`cache seed ${seed.key} failed: ${error.message}`);
  }
}

async function clearCacheSeeds(service: SupabaseClient): Promise<void> {
  for (const seed of CACHE_SEEDS) {
    await service.from('food_cache').delete().eq('cache_key', seed.key);
  }
}

// Mirrors the analyze-food gate order piece-wise (no HTTP, no persistence):
// VLM at tier1 → chooseTier → optional tier2 re-run → cascade → arithmetic.
async function driveCase(
  service: SupabaseClient,
  evalCase: EvalCase,
): Promise<CaseOutcome> {
  const started = performance.now();
  const request = evalCase.request;
  let items: ScanItemResponse[];
  let scanConfidence: number;
  let note: string | null;
  let tier: 'tier1' | 'tier2';

  if (request.kind === 'barcode') {
    tier = 'tier1';
    const grounded = await resolveBarcode(service, request.barcode!);
    if (!('per100g' in grounded)) {
      fail(`case ${evalCase.id}: barcode did not ground but the case expects a cache hit`);
    }
    items = [
      groundedItem(
        `barcode:${request.barcode}`,
        100,
        'packaged-serving',
        1,
        flagHiddenFat([`barcode:${request.barcode}`]),
        grounded.per100g,
      ),
    ];
    scanConfidence = 1;
    note = null;
  } else {
    const vlmInput = request.kind === 'text'
      ? { kind: request.kind, textDescription: request.textDescription }
      : { kind: request.kind, imageBase64: request.imageBase64 };

    const tier1Output = VlmOutputSchema.parse(await getVlmProvider().analyze(vlmInput, 'tier1'));
    tier = chooseTier(tier1Output);
    const output = tier === 'tier2'
      ? VlmOutputSchema.parse(await getVlmProvider().analyze(vlmInput, 'tier2'))
      : tier1Output;

    items = [];
    for (const vlmItem of output.items) {
      const hiddenFatLikely = vlmItem.hiddenFatLikely ||
        flagHiddenFat([vlmItem.label]) ||
        (request.kind === 'text' ? flagHiddenFat([request.textDescription ?? '']) : false);
      const grounded = await resolveFood(service, vlmItem.label);
      items.push(
        'per100g' in grounded
          ? groundedItem(
            vlmItem.label,
            vlmItem.grams,
            vlmItem.gramsBasis,
            vlmItem.confidence,
            hiddenFatLikely,
            grounded.per100g,
          )
          : unresolvedItem(vlmItem.label, vlmItem.grams, vlmItem.gramsBasis, vlmItem.confidence, hiddenFatLikely),
      );
    }
    scanConfidence = output.scanConfidence;
    note = output.note;
  }

  return {
    tier,
    response: {
      kind: request.kind,
      items,
      mealKcal: sumItemKcal(items),
      scanConfidence,
      note,
    },
    latencyMs: performance.now() - started,
  };
}

function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) fail('percentile of an empty sample');
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * q;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

async function main(): Promise<void> {
  emit(`mode: ${LIVE_MODE ? 'live (VLM_PROVIDER=gemini)' : 'fixture'}`);
  const { url, serviceRoleKey } = stackEnv();
  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const cases = await evalCases();
  await seedCache(service);
  const upserted: string[] = [];
  try {
    for (const evalCase of cases) {
      const { error } = await service.from('eval_cases').upsert({
        id: evalCase.id,
        kind: evalCase.request.kind,
        input: evalCase.request,
        expected: evalCase.expected,
        expected_tier: evalCase.expectedTier,
      });
      if (error) fail(`eval_cases upsert for ${evalCase.id} failed: ${error.message}`);
      upserted.push(evalCase.id);
    }

    const outcomes: { evalCase: EvalCase; outcome: CaseOutcome }[] = [];
    for (const evalCase of cases) {
      const outcome = await driveCase(service, evalCase);
      outcomes.push({ evalCase, outcome });
      // Fixture mode only: a real model will never reproduce the fixture's
      // sentinel items/kcal byte-for-byte, so live mode measures tier1
      // rate/latency (below) without asserting per-case exact match.
      if (!LIVE_MODE) {
        try {
          assertEquals(outcome.tier, evalCase.expectedTier);
          assertEquals(outcome.response, evalCase.expected);
        } catch (error) {
          fail(`case ${evalCase.id}: ${error.message}`);
        }
      }
      emit(
        `${LIVE_MODE ? 'RAN' : 'PASS'} case=${evalCase.id} tier=${outcome.tier} latencyMs=${
          Math.round(outcome.latencyMs)
        }`,
      );
    }

    const tier1Count = outcomes.filter((entry) => entry.outcome.tier === 'tier1').length;
    const tier1Rate = tier1Count / outcomes.length;
    const latencies = outcomes.map((entry) => entry.outcome.latencyMs).sort((a, b) => a - b);
    const p50 = percentile(latencies, 0.5);
    const p95 = percentile(latencies, 0.95);
    emit(`eval_cases: ${upserted.length} cases upserted (idempotent by id)`);

    if (LIVE_MODE) {
      // Printed for manual promotion (tests/golden/README.md) — never
      // compared against the fixture-calibrated constants above.
      emit(
        `LIVE-MODEL OBSERVED tier1 resolution: ${tier1Rate.toFixed(3)} (${tier1Count}/${outcomes.length})`,
      );
      emit(
        `LIVE-MODEL OBSERVED latency p50=${Math.round(p50)}ms p95=${Math.round(p95)}ms (interpolated)`,
      );
      emit(
        'EVAL RESULT: PASS (live-model — bounds NOT enforced; promote observed values into ' +
          'TIER1_RESOLUTION_TARGET/P95_LATENCY_MAX_MS by hand, see tests/golden/README.md)',
      );
      return;
    }

    emit(
      `tier1 resolution: ${tier1Rate.toFixed(3)} (${tier1Count}/${outcomes.length}) target >= ${TIER1_RESOLUTION_TARGET}`,
    );
    emit(
      `latency p50=${Math.round(p50)}ms p95=${Math.round(p95)}ms (interpolated) bound p95 <= ${P95_LATENCY_MAX_MS}ms`,
    );
    if (tier1Rate < TIER1_RESOLUTION_TARGET) {
      fail(
        `TIER1_RESOLUTION_TARGET breached: measured ${tier1Rate.toFixed(3)} < required ${TIER1_RESOLUTION_TARGET}`,
      );
    }
    if (p95 > P95_LATENCY_MAX_MS) {
      fail(
        `P95_LATENCY_MAX_MS breached: measured p95 ${Math.round(p95)}ms > bound ${P95_LATENCY_MAX_MS}ms`,
      );
    }
    emit('EVAL RESULT: PASS');
  } finally {
    await clearCacheSeeds(service);
  }
}

if (import.meta.main) await main();
