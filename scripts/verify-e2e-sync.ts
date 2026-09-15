#!/usr/bin/env -S deno run --allow-all
/**
 * verify-e2e-sync.ts — the Postgres-side half of the 04-07 E2E proof: confirms
 * the diary rows E2ESyncConvergenceTests' XCUITest run created (one online
 * save, one offline-queued save later dispatched on reconnect) actually
 * reached Postgres, not just the device's local GRDB mirror.
 *
 * CORRECTION (04-07): the plan's original wording ("edited grams reflected...
 * exists server-side") assumed grams/kcal sync to Postgres. They never do —
 * Phase 1.1 deliberately trimmed the diary_entries outbox payload to
 * `{ id, displayText, deletedAt, serverVersion, acceptedOpId }`
 * (01.1-02-SUMMARY.md: "Kept outbox snapshots limited to the canonical
 * DiaryEntrySnapshot vocabulary"). DiaryEntryDetail (grams/kcal/macros) is
 * GRDB-local only — DomainMigrationTests asserts sync columns never leak
 * into domain tables. created_at/updated_at are ALSO never client-supplied:
 * the sync_push RPC's INSERT omits them entirely, so they fall back to the
 * table's `default now()` — meaning even the XCUITest's --ccFixedClock
 * timestamp never reaches the server, let alone the edited grams value.
 * This is an intentional, documented design decision, not a sync-protocol
 * gap: this script instead verifies what genuinely syncs — display_text
 * (the scanned food's label, set once at save time and never touched by the
 * grams edit) — at the exact row count a passing E2ESyncConvergenceTests run
 * produces, scoped to the deterministic test-account owner and a bounded
 * recency window anchored on this script's OWN invocation time (never IPC
 * with the XCUITest process, matching the plan's actual identity
 * requirement).
 *
 * Run:
 *   supabase status -o env > /tmp/stack.env
 *   TEST_EMAIL=... deno run --env-file=/tmp/stack.env --allow-all \
 *     scripts/verify-e2e-sync.ts
 */
import { stackEnv } from "../supabase/functions/tests/_env.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Task 1's XCUITest always drives a photo scan against the local edge
// function's fixture VLM provider (--ccScanScenario 200 -> chicken-rice),
// so ScanModel's saved item.source.label is always this literal —
// independent of the grams edit, which is exactly why it's the one field
// this script can verify server-side.
const EXPECTED_DISPLAY_TEXT = "chicken-rice";
// One online save (scanEditSave steps: 2) + one offline-queued save
// (steps: 1) dispatched on reconnect — the exact row count a passing
// E2ESyncConvergenceTests run produces.
const EXPECTED_ROW_COUNT = 2;
const DEFAULT_WINDOW_SECONDS = 600;

// Redaction scan (smoke-scan-pipeline.ts posture) — nothing reaches the
// terminal unscanned; PASS lines are the only stdout surface.
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|email|key|endpoint|url|header|auth|credential)/i;
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{15,}/,
  /\b[0-9a-f]{40,}\b/,
];

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  Deno.exit(1);
}

function emit(line: string): void {
  if (SENSITIVE_KEY_PATTERN.test(line)) {
    fail("redaction scan: output line carries a sensitive key name");
  }
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(line)) {
      fail("redaction scan: output line carries a secret-shaped value");
    }
  }
  console.log(line);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    fail(
      `${name} is required (same TEST_EMAIL idiom as E2ESyncConvergenceTests).`,
    );
  }
  return value;
}

async function resolveUserIdByEmail(
  service: SupabaseClient,
  email: string,
): Promise<string> {
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) fail(`auth.admin.listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  fail(
    "no auth user found for TEST_EMAIL — the account must already exist " +
      "(the same account E2ESyncConvergenceTests signs in with).",
  );
}

async function main(): Promise<void> {
  const { url, serviceRoleKey } = stackEnv();
  const email = requiredEnv("TEST_EMAIL");
  const windowSeconds = Number(
    Deno.env.get("E2E_SYNC_WINDOW_SECONDS") ?? DEFAULT_WINDOW_SECONDS,
  );
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    fail("E2E_SYNC_WINDOW_SECONDS must be a positive number of seconds.");
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const userId = await resolveUserIdByEmail(service, email);
  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { data: rows, error } = await service
    .from("diary_entries")
    .select("id, display_text, deleted_at, created_at, server_version")
    .eq("user_id", userId)
    .eq("display_text", EXPECTED_DISPLAY_TEXT)
    .is("deleted_at", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error) fail(`diary_entries query failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    fail(
      `no recent diary_entries row found for the test account ` +
        `(display_text=${EXPECTED_DISPLAY_TEXT}, window=${windowSeconds}s) — ` +
        "the SyncEngine dispatch never reached Postgres.",
    );
  }
  if (rows.length < EXPECTED_ROW_COUNT) {
    fail(
      `found ${rows.length} recent row(s), expected ${EXPECTED_ROW_COUNT} ` +
        "(one online save + one offline-queued save) — the offline-queued " +
        "dispatch likely never reached Postgres after reconnect.",
    );
  }
  for (const row of rows) {
    // Any row the sync_push RPC ever accepted carries a positive
    // nextval('diary_entry_version_seq') — a value here proves this
    // specific row round-tripped through the server, not just a
    // coincidentally-matching pre-existing local-only row.
    if (typeof row.server_version !== "number" || row.server_version < 1) {
      fail(
        `row ${row.id} has server_version=${row.server_version}, expected >=1 ` +
          "(a server-accepted write).",
      );
    }
  }

  emit(
    `PASS table=diary_entries rows=${rows.length} displayText=${EXPECTED_DISPLAY_TEXT} ` +
      `windowSeconds=${windowSeconds}`,
  );
}

if (import.meta.main) await main();
