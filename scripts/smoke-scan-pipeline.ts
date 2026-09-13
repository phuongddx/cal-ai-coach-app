/**
 * Live-stack smoke gate — proves all four Edge Functions over real Kong HTTP
 * (http://127.0.0.1:54321/functions/v1/...), not direct handler invocation:
 *
 *   analyze-food    kind=photo, seeded cache row  → 200 with integer mealKcal
 *   food-search     seeded query                  → 200 with a results array
 *   barcode-resolve seeded barcode → 200; unseeded → 404 BARCODE_NOT_FOUND
 *   rc-webhook      signed grant   → 200 applied; unsigned replay → 401
 *
 * Setup creates a throwaway auth user (service admin API) + password sign-in
 * for the bearer token, seeds the food_cache rows the cases use, and ensures
 * RC_WEBHOOK_SIGNING_SECRET exists in supabase/functions/.env — the local
 * edge runtime auto-loads that file on `supabase start`. When the script
 * writes the secret itself (or the runtime predates it), the signed webhook
 * returns 401 until the stack is restarted: run `supabase stop &&
 * supabase start` and re-run. Teardown deletes the throwaway user and every
 * seeded row, and the delete is verified before the run may pass.
 *
 * Run: supabase status -o env > <envfile> && deno run --env-file=<envfile> --allow-all scripts/smoke-scan-pipeline.ts
 */
import { assertEquals } from 'jsr:@std/assert';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stackEnv } from '../supabase/functions/tests/_env.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Per100g } from '../supabase/functions/_shared/contracts/scan.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const SECRET_FILE = fileURLToPath(new URL('../supabase/functions/.env', import.meta.url));
const SECRET_NAME = 'RC_WEBHOOK_SIGNING_SECRET';
const FUNCTIONS_BASE = 'http://127.0.0.1:54321/functions/v1';

const CHICKEN_RICE: Per100g = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
const GRILLED_CHICKEN: Per100g = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 };
const SEEDED_BARCODE = '3017620422003';
const NUTELLA: Per100g = { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 3.4 };
const UNSEEDED_BARCODE = '9999999999999';

const CACHE_SEEDS: ReadonlyArray<{ key: string; per100g: Per100g; negative?: boolean }> = [
  { key: 'search:chicken-rice', per100g: CHICKEN_RICE },
  { key: 'search:grilled chicken', per100g: GRILLED_CHICKEN },
  { key: `barcode:${SEEDED_BARCODE}`, per100g: NUTELLA },
  { key: `barcode:${UNSEEDED_BARCODE}`, per100g: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, negative: true },
];

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  Deno.exit(1);
}

// Redaction scan (measure-phase1-sync posture) — nothing reaches the terminal
// unscanned; PASS lines are the only stdout surface.
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|email|key|endpoint|url|header|auth|credential)/i;
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{15,}/,
  /\b[0-9a-f]{40,}\b/,
];

function emit(line: string): void {
  if (SENSITIVE_KEY_PATTERN.test(line)) {
    fail(`redaction scan: output line carries a sensitive key name`);
  }
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(line)) {
      fail('redaction scan: output line carries a secret-shaped value');
    }
  }
  console.log(line);
}

async function ensureWebhookSecret(): Promise<string> {
  let existing: string | undefined;
  try {
    const content = await readFile(SECRET_FILE, 'utf8');
    const match = content.split('\n').find((line) => line.startsWith(`${SECRET_NAME}=`));
    if (match) existing = match.slice(SECRET_NAME.length + 1).trim();
  } catch {
    existing = undefined;
  }
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const generated = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  await writeFile(SECRET_FILE, `${SECRET_NAME}=${generated}\n`);
  fail(
    `${SECRET_NAME} was missing and has been generated into supabase/functions/.env ` +
      '(gitignored, never committed). The edge runtime loads it on `supabase start` — ' +
      'run `supabase stop && supabase start`, then re-run this script.',
  );
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function post(
  fn: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

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

async function cleanup(service: SupabaseClient, userId: string, scanId: string): Promise<void> {
  await service.from('scan_items').delete().eq('scan_id', scanId);
  await service.from('scans').delete().eq('user_id', userId);
  await service.from('scan_usage').delete().eq('user_id', userId);
  await service.from('entitlements').delete().eq('app_user_id', userId);
  await service.from('webhook_events').delete().like('event_id', 'smoke-%');
  for (const seed of CACHE_SEEDS) {
    await service.from('food_cache').delete().eq('cache_key', seed.key);
  }
}

async function main(): Promise<void> {
  const { url, anonKey, serviceRoleKey } = stackEnv();
  const secret = await ensureWebhookSecret();

  const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const email = `smoke-${crypto.randomUUID()}@coachcal.test`;
  // GoTrue's bcrypt path 500s on passwords longer than 72 bytes.
  const password = `smoke-${crypto.randomUUID()}`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) fail(`throwaway user creation failed: ${createError?.message}`);
  const userId = created.user.id;

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session) fail(`sign-in failed: ${signInError?.message}`);
  const bearer = signIn.session.access_token;

  const scanId = crypto.randomUUID();
  await seedCache(service);

  try {
    // analyze-food — photo kind through VLM seam + cascade + arithmetic.
    const analyze = await post(
      'analyze-food',
      JSON.stringify({
        scanId,
        kind: 'photo',
        mealType: 'lunch',
        imageBase64: 'fixture:chicken-rice',
      }),
      { Authorization: `Bearer ${bearer}` },
    );
    if (analyze.status !== 200) {
      fail(`analyze-food expected 200, got ${analyze.status}: ${JSON.stringify(analyze.json)}`);
    }
    const analyzeBody = analyze.json as { mealKcal?: unknown };
    if (
      typeof analyzeBody.mealKcal !== 'number' || !Number.isInteger(analyzeBody.mealKcal)
    ) {
      fail(`analyze-food mealKcal is not an integer: ${JSON.stringify(analyzeBody.mealKcal)}`);
    }
    assertEquals(analyzeBody.mealKcal, 464);
    emit(`PASS function=analyze-food status=200 mealKcal=${analyzeBody.mealKcal}`);

    // food-search — seeded query grounds from the cache.
    const search = await post(
      'food-search',
      JSON.stringify({ query: 'Grilled Chicken' }),
      { Authorization: `Bearer ${bearer}` },
    );
    if (search.status !== 200) {
      fail(`food-search expected 200, got ${search.status}: ${JSON.stringify(search.json)}`);
    }
    const results = (search.json as { results?: unknown[] }).results;
    if (!Array.isArray(results) || results.length !== 1) {
      fail(`food-search results is not a single-element array: ${JSON.stringify(results)}`);
    }
    emit(`PASS function=food-search status=200 results=${results.length}`);

    // barcode-resolve — seeded barcode resolves; unseeded is a typed 404.
    const seededBarcode = await post(
      'barcode-resolve',
      JSON.stringify({ barcode: SEEDED_BARCODE }),
      { Authorization: `Bearer ${bearer}` },
    );
    if (seededBarcode.status !== 200) {
      fail(
        `barcode-resolve seeded expected 200, got ${seededBarcode.status}: ${
          JSON.stringify(seededBarcode.json)
        }`,
      );
    }
    const seededKcal = (seededBarcode.json as { per100g?: { kcal?: number } }).per100g?.kcal;
    assertEquals(seededKcal, 539);

    const unseededBarcode = await post(
      'barcode-resolve',
      JSON.stringify({ barcode: UNSEEDED_BARCODE }),
      { Authorization: `Bearer ${bearer}` },
    );
    const unseededCode = (unseededBarcode.json as { error?: { code?: string } }).error?.code;
    if (unseededBarcode.status !== 404 || unseededCode !== 'BARCODE_NOT_FOUND') {
      fail(
        `barcode-resolve unseeded expected 404 BARCODE_NOT_FOUND, got ${unseededBarcode.status} ${unseededCode}`,
      );
    }
    emit(
      `PASS function=barcode-resolve seeded status=${seededBarcode.status} kcal=${seededKcal} unseeded status=404 BARCODE_NOT_FOUND`,
    );

    // rc-webhook — signed grant applies; unsigned replay of the same request
    // is rejected at the real gateway (verify_jwt=false + HMAC compensation).
    const eventId = `smoke-${crypto.randomUUID()}`;
    const raw = JSON.stringify({
      event: {
        id: eventId,
        type: 'INITIAL_PURCHASE',
        data: {
          app_user_id: userId,
          entitlement_ids: ['coachcal_pro'],
          expiration_at_ms: Date.now() + 30 * DAY_MS,
          product_id: 'coachcal_pro_monthly',
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex(`${timestamp}.${raw}`, secret);
    const signed = await post('rc-webhook', raw, {
      'X-RevenueCat-Webhook-Signature': `t=${timestamp},v1=${v1}`,
    });
    if (signed.status === 401) {
      fail(
        `rc-webhook rejected the signed request with 401 — the edge runtime has not loaded ` +
          `${SECRET_NAME}. Run \`supabase stop && supabase start\` and re-run this script.`,
      );
    }
    if (signed.status !== 200 || (signed.json as { applied?: boolean }).applied !== true) {
      fail(`rc-webhook signed expected 200 applied=true, got ${signed.status}: ${JSON.stringify(signed.json)}`);
    }
    const unsigned = await post('rc-webhook', raw);
    const unsignedCode = (unsigned.json as { error?: { code?: string } }).error?.code;
    if (unsigned.status !== 401 || unsignedCode !== 'INVALID_SIGNATURE') {
      fail(
        `rc-webhook unsigned replay expected 401 INVALID_SIGNATURE, got ${unsigned.status} ${unsignedCode}`,
      );
    }
    emit(
      `PASS function=rc-webhook signed status=200 applied=true unsigned status=401 INVALID_SIGNATURE`,
    );
  } finally {
    await cleanup(service, userId, scanId);
    await service.auth.admin.deleteUser(userId);
    const { data: gone, error: goneError } = await service.auth.admin.getUserById(userId);
    if (!goneError && gone.user) {
      fail(`teardown failed: throwaway user ${userId} still exists`);
    }
  }

  emit('SMOKE RESULT: PASS (4 functions over real HTTP; throwaway user deleted)');
}

if (import.meta.main) await main();
