import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./measure-phase1-sync.mjs', import.meta.url).pathname;

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'measure-test-'));
}

function validProof(over = {}) {
  return {
    schemaVersion: 1,
    scenario: 'online',
    runId: '11111111-1111-4111-8111-111111111111',
    rowId: 'aaaaaaaa-aaa1-4aaa-8aaa-aaaaaaaaaaa1',
    opId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    pendingCount: 0,
    serverVersion: 3,
    acceptedOpId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    deletedAt: null,
    tombstone: false,
    submittedAtMs: 1000,
    acknowledgedAtMs: 1800,
    capturedAtMs: 2000,
    ...over,
  };
}

function writeProof(dir, name, obj) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(obj));
  return path;
}

function runScript(args, input) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    input,
    encoding: 'utf8',
  });
}

describe('measure-phase1-sync.mjs', () => {
  test('accepts a valid online proof file within 2000ms and exits zero', () => {
    const dir = tmpDir();
    const path = writeProof(dir, 'online.json', validProof());
    const result = runScript(['--file', path]);
    assert.equal(result.status, 0, result.stderr);
  });

  test('rejects an online duration above 2000ms with exit 1', () => {
    const dir = tmpDir();
    const path = writeProof(dir, 'slow.json', validProof({ acknowledgedAtMs: 3500 }));
    const result = runScript(['--file', path]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duration|2000/i);
  });

  test('rejects a proof missing required fields', () => {
    const dir = tmpDir();
    const path = writeProof(dir, 'incomplete.json', {
      schemaVersion: 1,
      scenario: 'online',
    });
    const result = runScript(['--file', path]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing|invalid/i);
  });

  test('rejects sensitive payloads', () => {
    const dir = tmpDir();
    const path = writeProof(
      dir,
      'sensitive.json',
      validProof({ publishableKey: 'sb_publishable_XXX', email: 'a@proof.local' })
    );
    const result = runScript(['--file', path]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sensitive|redact/i);
  });

  test('accepts a valid proof via stdin', () => {
    const result = runScript([], JSON.stringify(validProof()));
    assert.equal(result.status, 0, result.stderr);
  });

  test('rejects both --file and stdin', () => {
    const dir = tmpDir();
    const path = writeProof(dir, 'a.json', validProof());
    const result = runScript(['--file', path], JSON.stringify(validProof()));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /one input/i);
  });

  test('rejects no input at all', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: '',
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /input required/i);
  });

  test('compare-convergence exits zero for matching same-owner records', () => {
    const dir = tmpDir();
    const a = writeProof(dir, 'a.json', validProof({ scenario: 'same-owner-convergence' }));
    const b = writeProof(
      dir,
      'b.json',
      validProof({
        scenario: 'same-owner-convergence',
        runId: '22222222-2222-4222-8222-222222222222',
        serverVersion: 3,
      })
    );
    const result = runScript(['--compare-convergence', a, b]);
    assert.equal(result.status, 0, result.stderr);
  });

  test('compare-convergence exits nonzero when canonical fields differ', () => {
    const dir = tmpDir();
    const a = writeProof(dir, 'a.json', validProof({ scenario: 'same-owner-convergence', serverVersion: 3 }));
    const b = writeProof(
      dir,
      'b.json',
      validProof({ scenario: 'same-owner-convergence', serverVersion: 4 })
    );
    const result = runScript(['--compare-convergence', a, b]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /mismatch/i);
  });

  test('compare-convergence exits nonzero when tombstone state differs', () => {
    const dir = tmpDir();
    const a = writeProof(
      dir,
      'a.json',
      validProof({ scenario: 'same-owner-convergence', tombstone: false })
    );
    const b = writeProof(
      dir,
      'b.json',
      validProof({
        scenario: 'same-owner-convergence',
        tombstone: true,
        deletedAt: '2026-09-12T01:00:00.000Z',
      })
    );
    const result = runScript(['--compare-convergence', a, b]);
    assert.equal(result.status, 1);
  });

  test('compare-convergence exits nonzero with fewer or more than two files', () => {
    const dir = tmpDir();
    const a = writeProof(dir, 'a.json', validProof({ scenario: 'same-owner-convergence' }));
    assert.equal(runScript(['--compare-convergence', a]).status, 1);
    assert.equal(
      runScript(['--compare-convergence', a, a, a]).status,
      1
    );
  });

  test('compare-convergence exits nonzero when scenarios differ', () => {
    const dir = tmpDir();
    const a = writeProof(dir, 'a.json', validProof({ scenario: 'same-owner-convergence' }));
    const b = writeProof(dir, 'b.json', validProof({ scenario: 'online' }));
    assert.equal(runScript(['--compare-convergence', a, b]).status, 1);
  });
});
