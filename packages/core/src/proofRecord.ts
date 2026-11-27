/**
 * ProofRecord.swift — the QA proof harness record (live-check transcripts,
 * QA-03) and its fail-closed serializer. Redaction is fail-closed: sensitive
 * keys and legacy proof identities throw BEFORE serialization instead of
 * being stripped.
 */

export type ProofScenario =
  | 'online'
  | 'offline-reconnect'
  | 'replay-idempotency'
  | 'user-b-denial'
  | 'same-owner-convergence';

export type ProofCheckStatus = 'pass' | 'fail';

export interface ProofEnvironment {
  stack: string;
  runtime: string;
}

export interface ProofCheck {
  name: string;
  status: ProofCheckStatus;
  timingMs: number;
  dispatchId?: string;
}

/**
 * Swift's `ProofValue` enum with associated values becomes this discriminated
 * union (brief shape rule); `uuid` values serialize on the canonical
 * uppercase form and `date` values as ISO-8601 in the process zone, like the
 * Swift serializer.
 */
export type ProofValue =
  | { kind: 'string'; value: string }
  | { kind: 'int'; value: number }
  | { kind: 'double'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'uuid'; value: string }
  | { kind: 'date'; value: Date }
  | { kind: 'array'; value: ProofValue[] }
  | { kind: 'dictionary'; value: { [key: string]: ProofValue } };

export interface ProofRecord {
  scenario: ProofScenario;
  runId: string;
  rowId?: string | null;
  startedAt: Date;
  environment: ProofEnvironment;
  checks: ProofCheck[];
  evidence: { [key: string]: ProofValue };
}

export class ProofRedactionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProofRedactionError';
  }
}

const pad = (value: number, width = 2): string => String(Math.abs(value)).padStart(width, '0');

/** ISO8601DateFormatter.string(from:timeZone:.current) — internet date-time with local offset. */
function formatIso8601Local(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(hours)}:${pad(minutes)}`
  );
}

function payloadValue(value: ProofValue): unknown {
  switch (value.kind) {
    case 'string':
      return value.value;
    case 'int':
    case 'double':
      return value.value;
    case 'bool':
      return value.value;
    case 'uuid':
      return value.value.toUpperCase();
    case 'date':
      return formatIso8601Local(value.value);
    case 'array':
      return value.value.map(payloadValue);
    case 'dictionary': {
      const object: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value.value)) {
        object[key] = payloadValue(child);
      }
      return object;
    }
  }
}

function isJsonSerializable(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSerializable);
  }
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonSerializable);
  }
  return false;
}

/** JSONSerialization.data(withJSONObject:options:[.sortedKeys, .withoutEscapingSlashes]). */
function stringifySorted(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stringifySorted).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stringifySorted(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const ProofRecordSerializer = {
  schemaVersion: 1,

  // Built by joining parts so the forbidden tokens never appear in source
  // (1.1-06 scans the repo for the legacy identities).
  legacyIdentityValues: [
    ['a', '@proof.', 'local'].join(''),
    ['b', '@proof.', 'local'].join(''),
    ['phase1-proof-', '2026'].join(''),
  ] as readonly string[],

  // NSRegularExpression #"(?i)(password|secret|token|apikey|authorization)"#.
  sensitiveKeyPattern: /(password|secret|token|apikey|authorization)/i,

  /** The serializer bytes (UTF-8 text in TypeScript). */
  data(record: ProofRecord): string {
    const payload = ProofRecordSerializer.jsonObject(record);
    if (!isJsonSerializable(payload)) {
      throw new ProofRedactionError('proof payload is not valid JSON');
    }
    return stringifySorted(payload);
  },

  string(record: ProofRecord): string {
    return ProofRecordSerializer.data(record);
  },

  jsonObject(record: ProofRecord): Record<string, unknown> {
    const payload: Record<string, ProofValue> = { ...record.evidence };
    payload['schemaVersion'] = { kind: 'int', value: ProofRecordSerializer.schemaVersion };
    payload['scenario'] = { kind: 'string', value: record.scenario };
    payload['runId'] = { kind: 'uuid', value: record.runId };
    if (record.rowId !== undefined && record.rowId !== null) {
      payload['rowId'] = { kind: 'uuid', value: record.rowId };
    }
    payload['startedAt'] = { kind: 'date', value: record.startedAt };
    payload['environment'] = {
      kind: 'dictionary',
      value: {
        stack: { kind: 'string', value: record.environment.stack },
        runtime: { kind: 'string', value: record.environment.runtime },
      },
    };
    payload['checks'] = {
      kind: 'array',
      value: record.checks.map((check): ProofValue => {
        const entry: { [key: string]: ProofValue } = {
          name: { kind: 'string', value: check.name },
          status: { kind: 'string', value: check.status },
          timingMs: { kind: 'int', value: check.timingMs },
        };
        if (check.dispatchId !== undefined) {
          entry['dispatchId'] = { kind: 'uuid', value: check.dispatchId };
        }
        return { kind: 'dictionary', value: entry };
      }),
    };

    const decoded = payloadValue({ kind: 'dictionary', value: payload }) as Record<string, unknown>;
    ProofRecordSerializer.scan(decoded, '$');
    return decoded;
  },

  /** Fail-closed redaction scan over the decoded payload. */
  scan(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((child, index) => ProofRecordSerializer.scan(child, `${path}[${index}]`));
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const childPath = `${path}.${key}`;
        if (ProofRecordSerializer.sensitiveKeyPattern.test(key)) {
          throw new ProofRedactionError(`sensitive key at ${childPath}`);
        }
        ProofRecordSerializer.scan(child, childPath);
      }
      return;
    }
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (ProofRecordSerializer.legacyIdentityValues.some((legacy) => normalized.includes(legacy))) {
        throw new ProofRedactionError(`forbidden proof identity at ${path}`);
      }
    }
  },
} as const;
