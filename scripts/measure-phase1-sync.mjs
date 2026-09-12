#!/usr/bin/env node
/**
 * Plan 01-05 Task 2: strict redacted proof validator / latency recorder /
 * same-owner convergence comparator.
 *
 * Input contract — exactly ONE of:
 *   --file <redacted-proof-file>
 *   piped standard input (non-TTY stdin with content)
 *   --compare-convergence <file-a> <file-b>
 *
 * Exits 0 only when the supplied evidence is complete, redacted, and (for the
 * online scenario) within the 2000ms roadmap bound. Prints a redacted summary.
 */
import { readFileSync, statSync } from 'node:fs';
import { stdin, argv, exit } from 'node:process';

const ONLINE_MAX_MS = 2000;
const SCENARIOS = new Set([
  'online',
  'offline-reconnect',
  'user-b-denial',
  'same-owner-convergence',
]);
const REQUIRED_STRING_FIELDS = ['schemaVersion', 'scenario', 'runId', 'rowId'];
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|email|key|endpoint|url|header|auth|credential)/i;

function fail(message) {
  process.stderr.write(`FAIL: ${message}\n`);
  exit(1);
}

function readInput() {
  const fileIndex = argv.indexOf('--file');
  const hasFile = fileIndex !== -1;
  let stdinContent = '';
  try {
    stdinContent = readFileSync(0, 'utf8');
  } catch {
    stdinContent = '';
  }
  const hasStdin = !stdin.isTTY && stdinContent.trim().length > 0;

  if (hasFile && hasStdin) {
    fail('provide exactly one input: --file OR standard input');
  }
  if (hasFile) {
    return readFileSync(argv[fileIndex + 1], 'utf8');
  }
  if (hasStdin) {
    return stdinContent;
  }
  fail('input required: pass --file <proof.json> or pipe one proof object on stdin');
}

function parseProof(raw, source) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`${source}: malformed JSON (${error.message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail(`${source}: proof must be a JSON object`);
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (parsed[field] === undefined || parsed[field] === null) {
      fail(`${source}: missing required field "${field}"`);
    }
  }
  if (!SCENARIOS.has(parsed.scenario)) {
    fail(`${source}: unknown scenario "${parsed.scenario}"`);
  }
  if (parsed.schemaVersion !== 1) {
    fail(`${source}: unsupported schemaVersion`);
  }
  for (const key of Object.keys(parsed)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      fail(
        `${source}: sensitive key "${key}" found — proof objects must be redacted`
      );
    }
    if (typeof parsed[key] === 'string' && SENSITIVE_KEY_PATTERN.test(parsed[key]) && !['scenario', 'runId', 'rowId', 'opId', 'acceptedOpId', 'deletedAt'].includes(key)) {
      fail(`${source}: field "${key}" carries sensitive-looking content — redact it`);
    }
  }
  return parsed;
}

function summarizeOnline(proof) {
  if (typeof proof.submittedAtMs !== 'number' || typeof proof.acknowledgedAtMs !== 'number') {
    fail('online scenario requires numeric submittedAtMs and acknowledgedAtMs');
  }
  const duration = proof.acknowledgedAtMs - proof.submittedAtMs;
  if (duration < 0) fail('acknowledgedAtMs precedes submittedAtMs');
  if (duration > ONLINE_MAX_MS) {
    fail(`sync duration ${duration}ms exceeds the ${ONLINE_MAX_MS}ms bound`);
  }
  process.stdout.write(
    `PASS scenario=${proof.scenario} durationMs=${duration} serverVersion=${proof.serverVersion ?? 'n/a'}\n`
  );
}

function summarizeGeneric(proof) {
  process.stdout.write(
    `PASS scenario=${proof.scenario} tombstone=${proof.tombstone === true} pendingCount=${proof.pendingCount ?? 'n/a'}\n`
  );
}

function compareConvergence(pathA, pathB) {
  if (!pathA || !pathB) {
    fail('compare-convergence requires exactly two proof files');
  }
  const extra = argv[argv.indexOf('--compare-convergence') + 3];
  if (extra !== undefined) {
    fail('compare-convergence accepts exactly two files');
  }
  for (const path of [pathA, pathB]) {
    try {
      statSync(path);
    } catch {
      fail(`cannot read proof file: ${path}`);
    }
  }
  const a = parseProof(readFileSync(pathA, 'utf8'), pathA);
  const b = parseProof(readFileSync(pathB, 'utf8'), pathB);

  if (a.scenario !== 'same-owner-convergence' || b.scenario !== 'same-owner-convergence') {
    fail('compare-convergence requires two same-owner-convergence records');
  }
  const mismatches = [];
  if (a.rowId !== b.rowId) mismatches.push('rowId');
  if (a.serverVersion !== b.serverVersion) mismatches.push('serverVersion');
  if (a.acceptedOpId !== b.acceptedOpId) mismatches.push('acceptedOpId');
  const aTombstone = a.tombstone === true;
  const bTombstone = b.tombstone === true;
  if (aTombstone !== bTombstone) mismatches.push('tombstone');
  if (mismatches.length > 0) {
    fail(`same-owner convergence mismatch: ${mismatches.join(', ')}`);
  }
  process.stdout.write(
    `PASS convergence rowId=${a.rowId} serverVersion=${a.serverVersion} acceptedOpId=${a.acceptedOpId} tombstone=${aTombstone}\n`
  );
}

// --- main -------------------------------------------------------------------
const compareIndex = argv.indexOf('--compare-convergence');
if (compareIndex !== -1) {
  compareConvergence(argv[compareIndex + 1], argv[compareIndex + 2]);
  exit(0);
}

const proof = parseProof(readInput(), 'proof');
if (proof.scenario === 'online') {
  summarizeOnline(proof);
} else {
  summarizeGeneric(proof);
}
