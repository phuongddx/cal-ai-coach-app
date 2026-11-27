/**
 * The sync ports (spec D4: engine injected with a `SyncStore` port, a
 * `SyncTransport` port, a clock and an `isOnline()` function, so it is
 * unit-tested without React Native).
 *
 * Two implementations of `SyncStore` exist: the real SQLite one
 * (`store.sqlite.ts`) and an in-memory one used by the Jest tests.
 * `SyncTransport` has the fetch implementation (`src/data/api/syncClient.ts`)
 * and fakes in the tests.
 */
import type { Meal, MealRecord, PullResponse, PushResponse, SyncOperation } from '@coachcal/api-contract';

/** A meal row as it lives locally: the wire Meal plus the record extras. `serverVersion = 0` means never acked. */
export type LocalMeal = Meal & {
  deleted: boolean;
  serverVersion: number;
  acceptedOpId: string | null;
};

export type OutboxState = 'pending' | 'quarantined';

export type OutboxEntry = {
  op: SyncOperation;
  attempts: number;
  state: OutboxState;
  lastError: string | null;
  createdAt: number;
  /** Epoch ms before which the operation is not due again (set by a failed attempt); null when due. */
  nextRetryAt: number | null;
};

/**
 * A stored operation that cannot be turned into a wire operation (Swift: the snapshot does not
 * decode, or the table or kind is unsupported). The decode failure is deterministic, so the engine
 * counts attempts and dead-letters it instead of leaving it in the batch forever.
 */
export type UndecodableOperation = {
  opId: string;
  attempts: number;
  reason: string;
};

/** What a dispatch takes from the outbox: FIFO, at most `limit` rows, due at `dueAt`. */
export type DueBatch = {
  operations: OutboxEntry[];
  undecodable: UndecodableOperation[];
};

export interface SyncStore {
  /** Local write = one transaction: write the meal row, insert the outbox operation. */
  recordUpsert(meal: Meal, op: SyncOperation): Promise<void>;
  /** Local delete = one transaction: remove the row at once, queue a tombstone. */
  recordDelete(recordId: string, op: SyncOperation): Promise<void>;
  /** "Has pending local intent": an outbox row exists for the record id (any state). */
  hasPendingIntent(recordId: string): Promise<boolean>;

  cursor(): Promise<number>;
  /** FIFO by enqueue order, state = pending, whatever the retry time (undecodable rows are left out). */
  pendingOperations(limit: number): Promise<OutboxEntry[]>;
  /**
   * The due batch of a dispatch (Swift `OutboxRepository.dueOps`): FIFO, not quarantined, retry time
   * passed or never set, at most `limit` rows. Rows that cannot be decoded come back in `undecodable`
   * and take a batch slot, as they do in Swift.
   */
  dueOperations(limit: number, dueAt: number): Promise<DueBatch>;
  /** Quarantined operations (undecodable rows are left out). */
  quarantinedOperations(): Promise<OutboxEntry[]>;
  getMeal(recordId: string): Promise<LocalMeal | null>;
  listMeals(): Promise<LocalMeal[]>;
  outboxCount(): Promise<number>;

  /**
   * Push acks, one transaction: remove each acked operation, stamp the acked
   * record's `serverVersion`/`acceptedOpId` onto the local row, and overwrite
   * the row with the server record unless another outbox row exists for that
   * record. A deleted record with no outbox row is removed locally.
   */
  applyPushAcks(entries: Array<{ op: SyncOperation; record: MealRecord }>): Promise<void>;
  /**
   * One pull page, one transaction: skip records with pending local intent,
   * upsert the rest, remove deleted ones, store the new cursor.
   */
  applyPullPage(rows: PullResponse['rows'], newCursor: number): Promise<void>;
  /** Bookkeeping after a failed attempt: bumps `attempts`, stores the error, sets when the op is due again. */
  markAttempts(opIds: string[], lastError: string | null, retryAt: number | null): Promise<void>;
  /** Quarantines the given operations; never retried automatically. */
  quarantine(opIds: string[], lastError: string): Promise<void>;
  /** Empties meals, outbox and sync_state (cursor and device id). */
  reset(): Promise<void>;
}

export interface SyncTransport {
  push(operations: SyncOperation[]): Promise<PushResponse>;
  pull(cursor: number, limit: number): Promise<PullResponse>;
}

export type SyncErrorKind = 'offline' | 'unauthorized' | 'invalidRequest' | 'server' | 'transport';

/** Typed sync errors (spec: Error handling). The outbox is never emptied by a failed push. */
export class SyncError extends Error {
  readonly kind: SyncErrorKind;
  readonly details?: unknown;

  constructor(kind: SyncErrorKind, message: string, options?: { details?: unknown; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SyncError';
    this.kind = kind;
    this.details = options?.details;
  }
}
