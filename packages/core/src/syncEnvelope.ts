/**
 * SyncEnvelope.swift — everything the Swift file does beyond the wire types.
 *
 * The wire shapes themselves already live as zod schemas in
 * `packages/api-contract/src/sync.ts` (the RN contract, spec D4/I4/I10); zod
 * never enters this package. What ports here is the Swift-side RULES as pure
 * functions over structural types: the strict key sets
 * (`rejectUnknownKeys`, the decode of a snapshot payload), the non-negative
 * `serverVersion` rules, the push-batch invariants (non-empty, unique
 * opIds), the exact-acknowledgement-set validation, the pull-cursor rules,
 * the ISO-8601 offset-date codec, and the `SyncTransport` surface.
 */

export type SyncedTable = 'diary_entries';

export type MutationKind = 'upsert' | 'tombstone';

export interface DiaryEntrySnapshot {
  id: string;
  displayText: string;
  deletedAt: string | null;
  serverVersion: number;
  acceptedOpId: string | null;
}

export interface SyncOperation {
  opId: string;
  table: SyncedTable;
  recordId: string;
  kind: MutationKind;
  snapshot: DiaryEntrySnapshot;
  /** ISO-8601 offset instant (Swift encodes `clientTimestamp` the same way). */
  clientTimestamp: string;
}

export interface PushRequest {
  operations: SyncOperation[];
}

export interface PushAcknowledgement {
  opId: string;
  serverVersion: number;
  acceptedOpId: string;
  duplicate: boolean;
}

export interface PushResponse {
  accepted: PushAcknowledgement[];
}

export interface PulledRow {
  table: SyncedTable;
  recordId: string;
  snapshot: DiaryEntrySnapshot;
}

export interface PullResponse {
  rows: PulledRow[];
  cursor: number;
}

export interface SyncTransport {
  push(request: PushRequest): Promise<PushResponse>;
  pull(cursor: number): Promise<PullResponse>;
}

/** The Swift side throws `DecodingError.dataCorrupted`; this is that error. */
export class SyncEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncEnvelopeError';
  }
}

const DIARY_ENTRY_SNAPSHOT_KEYS = ['id', 'displayText', 'deletedAt', 'serverVersion', 'acceptedOpId'] as const;

/** SyncEnvelopeDecoder.rejectUnknownKeys: sorted, comma-joined unknown names. */
export function rejectUnknownKeys(keys: readonly string[], allowed: readonly string[]): void {
  const unknown = keys.filter((key) => !allowed.includes(key)).sort();
  if (unknown.length > 0) {
    throw new SyncEnvelopeError(`Unknown sync envelope keys: ${unknown.join(', ')}`);
  }
}

const ISO_OFFSET_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * SyncEnvelopeDecoder.date: fractional seconds first, then plain
 * internet-date-time; anything looser is a dataCorrupted error.
 */
export function parseSyncDate(value: string): Date {
  if (!ISO_OFFSET_PATTERN.test(value)) {
    throw new SyncEnvelopeError(`Invalid ISO-8601 offset date: ${value}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SyncEnvelopeError(`Invalid ISO-8601 offset date: ${value}`);
  }
  return parsed;
}

/** SyncEnvelopeDecoder.string(from:) — internet date-time, no fractional seconds (UTC). */
export function formatSyncDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function requireKey(input: Record<string, unknown>, key: string): void {
  if (!(key in input)) {
    throw new SyncEnvelopeError(`Missing ${key}`);
  }
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') {
    throw new SyncEnvelopeError(`Invalid ${key}`);
  }
  return value;
}

/**
 * The Swift `DiaryEntrySnapshot.init(from:)`: every key required, unknown
 * keys rejected, `deletedAt`/`acceptedOpId` optional-but-present (explicit
 * null), and a non-negative `serverVersion`.
 */
export function decodeDiaryEntrySnapshot(raw: unknown): DiaryEntrySnapshot {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SyncEnvelopeError('snapshot must be a JSON object');
  }
  const input = raw as Record<string, unknown>;
  rejectUnknownKeys(Object.keys(input), DIARY_ENTRY_SNAPSHOT_KEYS);
  for (const key of DIARY_ENTRY_SNAPSHOT_KEYS) {
    requireKey(input, key);
  }
  const deletedAtRaw = input['deletedAt'];
  const deletedAt =
    deletedAtRaw === null ? null : formatSyncDate(parseSyncDate(requireString(input, 'deletedAt')));
  const serverVersion = input['serverVersion'];
  if (typeof serverVersion !== 'number' || !Number.isInteger(serverVersion)) {
    throw new SyncEnvelopeError('Invalid serverVersion');
  }
  if (serverVersion < 0) {
    throw new SyncEnvelopeError('serverVersion must be non-negative');
  }
  const acceptedOpIdRaw = input['acceptedOpId'];
  const acceptedOpId = acceptedOpIdRaw === null ? null : requireString(input, 'acceptedOpId');
  return {
    id: requireString(input, 'id'),
    displayText: requireString(input, 'displayText'),
    deletedAt,
    serverVersion,
    acceptedOpId,
  };
}

/**
 * PushRequest.init: the batch must not be empty and must not repeat an opId —
 * the engine drains FIFO batches of up to 50 through this invariant.
 */
export function createPushRequest(operations: readonly SyncOperation[]): PushRequest {
  if (operations.length === 0) {
    throw new SyncEnvelopeError('Push batch must not be empty');
  }
  const opIds = operations.map((operation) => operation.opId);
  if (new Set(opIds).size !== operations.length) {
    throw new SyncEnvelopeError('Push batch must not repeat an opId');
  }
  return { operations: [...operations] };
}

/**
 * PushResponse.validateAcknowledgementSet(against:): the acknowledged set
 * must equal the submitted set — no unsent opIds, no duplicates, no partial
 * acknowledgements (exact-ack-set validation, spec §5).
 */
export function validateAcknowledgementSet(
  operations: readonly { opId: string }[],
  accepted: readonly { opId: string }[],
): void {
  const submitted = new Set(operations.map((operation) => operation.opId));
  const acknowledged = new Set<string>();

  for (const acknowledgement of accepted) {
    if (!submitted.has(acknowledgement.opId)) {
      throw new SyncEnvelopeError(
        `Push response acknowledges unsent operation ${acknowledgement.opId}`,
      );
    }
    if (acknowledged.has(acknowledgement.opId)) {
      throw new SyncEnvelopeError(
        `Push response acknowledges operation ${acknowledgement.opId} more than once`,
      );
    }
    acknowledged.add(acknowledgement.opId);
  }

  if (acknowledged.size !== submitted.size) {
    throw new SyncEnvelopeError(
      `Push response acknowledges ${acknowledged.size} of ${submitted.size} submitted operations; refusing a partial acknowledgement set`,
    );
  }
}

/**
 * PullResponse.validate: the cursor is non-negative and at least the highest
 * delivered record version, so a client never rewinds its merge clock.
 */
export function validatePullResponse(response: {
  rows: readonly { snapshot: { serverVersion: number } }[];
  cursor: number;
}): void {
  if (response.cursor < 0) {
    throw new SyncEnvelopeError('Pull cursor must be non-negative');
  }
  if (!response.rows.every((row) => row.snapshot.serverVersion <= response.cursor)) {
    throw new SyncEnvelopeError('Pull cursor must be at least the highest delivered serverVersion');
  }
}
