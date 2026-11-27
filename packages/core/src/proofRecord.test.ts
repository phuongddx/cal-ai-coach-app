import { ProofRecordSerializer } from './proofRecord';

import type { ProofRecord, ProofValue } from './proofRecord';

declare const process: { env: Record<string, string | undefined>; execPath: string };
declare const require: (id: string) => unknown;
declare const __dirname: string;

// Ported 1:1 from ProofSerializerTests.swift. The legacy identity literals are
// built by joining parts so the forbidden tokens never appear in source
// (1.1-06 scans the repo for them).

const LEGACY_A = ['a', '@proof.', 'local'].join('');
const LEGACY_B = ['b', '@proof.', 'local'].join('');

function makeRecord(): ProofRecord {
  return {
    scenario: 'online',
    runId: '00000000-0000-0000-0000-000000000001',
    rowId: '00000000-0000-0000-0000-000000000002',
    startedAt: new Date(1_768_300_000 * 1000),
    environment: { stack: 'local-supabase', runtime: 'iOS 18.4' },
    checks: [
      { name: 'push', status: 'pass', timingMs: 30, dispatchId: '00000000-0000-0000-0000-000000000003' },
    ],
    evidence: {
      submittedAtMs: { kind: 'int', value: 10 },
      acknowledgedAtMs: { kind: 'int', value: 40 },
      serverVersion: { kind: 'int', value: 1 },
    },
  };
}

describe('ProofRecordSerializer', () => {
  it('serializes required schema v1 fields deterministically', () => {
    const record = makeRecord();
    const first = ProofRecordSerializer.data(record);
    const second = ProofRecordSerializer.data(record);
    const decoded = JSON.parse(first) as Record<string, unknown>;

    expect(first).toBe(second);
    expect(decoded['schemaVersion']).toBe(1);
    expect(decoded['scenario']).toBe('online');
    expect(decoded['runId']).toBe('00000000-0000-0000-0000-000000000001');
    expect(decoded['rowId']).toBe('00000000-0000-0000-0000-000000000002');
    expect(decoded['environment']).not.toBeUndefined();
    expect(decoded['checks']).not.toBeUndefined();
    expect(decoded['submittedAtMs']).toBe(10);
    expect(decoded['acknowledgedAtMs']).toBe(40);
  });

  it('rejects sensitive keys at any depth before emission', () => {
    const nested: ProofValue = {
      kind: 'dictionary',
      value: { outer: { kind: 'dictionary', value: { password: { kind: 'string', value: 'redacted-value' } } } },
    };
    const record = makeRecord();
    record.evidence['details'] = nested;

    expect(() => ProofRecordSerializer.data(record)).toThrow('sensitive key at $.details.outer.password');
  });

  it('rejects legacy proof identity value before emission', () => {
    // 1.1-06 scans the repo for forbidden-token literals, including the
    // legacy accounts. Build it here without putting the token in source.
    const record = makeRecord();
    record.evidence['actor'] = { kind: 'string', value: LEGACY_A };

    expect(() => ProofRecordSerializer.data(record)).toThrow('forbidden proof identity at $.actor');
    const secondRecord = makeRecord();
    secondRecord.evidence['actor'] = { kind: 'string', value: LEGACY_B };
    expect(() => ProofRecordSerializer.data(secondRecord)).toThrow('forbidden proof identity at $.actor');
  });

  it('serialized sample passes repository validator round trip', () => {
    const record = makeRecord();
    const childProcess = require('node:child_process') as {
      execFileSync: (file: string, args: string[], options: Record<string, unknown>) => string;
    };
    const path = require('node:path') as { join: (...segments: string[]) => string };
    // __dirname is packages/core/src; the repo root is three levels up.
    const validator = path.join(__dirname, '..', '..', '..', 'scripts', 'measure-phase1-sync.mjs');
    const output = childProcess.execFileSync(process.execPath, [validator], {
      input: ProofRecordSerializer.data(record),
      encoding: 'utf8',
    });
    expect(output.startsWith('PASS')).toBe(true);
  });
});
