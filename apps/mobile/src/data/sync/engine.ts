/**
 * The sync engine (spec D4), a port of `SyncEngine.swift` (CoachCalSync). It is injected with a
 * `SyncStore` port, a `SyncTransport` port, a clock and an `isOnline()` function, so it is unit-tested
 * without React Native.
 *
 * What it keeps from the Swift actor:
 *  - **Owner binding.** `bind(owner)` / `stop()`; without an owner `dispatch()` throws `notBound`.
 *    `stop()` drains the in-flight dispatch, and a `bind()` issued meanwhile waits for that barrier.
 *  - **Generation tokens.** The generation is re-checked after every awaited store or transport call;
 *    a dispatch that was overtaken by `stop()`/`bind()` returns without touching the store again.
 *  - **One dispatch at a time.** A call made while one runs asks for exactly one trailing rerun and
 *    returns at once, so the same batch is never pushed twice.
 *  - **Debounce.** `notifyLocalMutation()` is a trailing-edge 500 ms debounce: a burst resets the
 *    interval and only the last timer dispatches. Errors of such a background dispatch go to the sink.
 *  - **Batches of 50, FIFO**, taken from the outbox's due rows (retry time passed or never set).
 *  - **Exact acknowledgement set.** `validateAcknowledgementSet` runs before any acknowledgement is
 *    applied; a foreign, duplicated or partial set rejects the whole batch.
 *  - **Attempts.** A failed push or pull counts one dispatch attempt on the batch's operations and
 *    schedules their next try with `Backoff`; an operation that reaches 5 attempts is quarantined
 *    (dead-lettered, kept in the outbox). An operation that cannot be decoded is counted the same way
 *    (`poisoned`).
 *
 * What differs on purpose (parity-detail/sync.md):
 *  - After the push the engine pulls pages until `hasMore` is false (Swift pulls one page per dispatch),
 *    and a full batch loops for the next one.
 *  - A 400 on the push quarantines the whole batch at once: the API said the request itself is invalid,
 *    so retrying it five times cannot help. 401 stops without counting an attempt.
 *  - `validatePullResponse` guards the cursor of every page (the transport port carries contract rows,
 *    so each is mapped to the `{snapshot}` shape the core function takes).
 *  - `sync()` is the UI-facing wrapper: it never throws on a typed failure and keeps a status, a
 *    forced-offline switch and a retry timer for the debug console and the Today screen.
 */
import { validateAcknowledgementSet, validatePullResponse } from '@coachcal/core';
import { SyncOperationSchema, type SyncOperation } from '@coachcal/api-contract';

import { backoffDelayMs } from './backoff';
import { SyncError, type OutboxEntry, type SyncStore, type SyncTransport } from './types';

export type SyncStatus =
  | 'synced'
  | 'offline'
  | 'retryScheduled'
  | 'quarantined'
  | 'unauthorized'
  | 'invalidRequest';

export type SyncResult = {
  status: SyncStatus;
  /** Operations accepted by the server (applied + duplicate). */
  pushed: number;
  /** Records delivered by the server (rows of the pulled pages). */
  pulled: number;
  detail?: string;
};

/** Swift `DispatchResult`. */
export type DispatchResult = {
  /** Operations sent to the server. */
  pushed: number;
  /** Operations the server acknowledged. */
  acked: number;
  /** Rows delivered by the pulled pages. */
  pulled: number;
  /** Operations that could not be decoded in this dispatch. */
  poisoned: number;
  cursorAdvanced: boolean;
};

/** Swift `SyncEngineError`. */
export class SyncEngineError extends Error {
  readonly kind: 'notBound' | 'poisonedOperations';
  /** For `poisonedOperations`: how many operations. */
  readonly count: number;

  constructor(kind: 'notBound' | 'poisonedOperations', count = 0) {
    super(kind === 'notBound' ? 'the sync engine is not bound to a user' : `poisonedOperations(count: ${count})`);
    this.name = 'SyncEngineError';
    this.kind = kind;
    this.count = count;
  }
}

export type EngineDeps = {
  store: SyncStore;
  transport: SyncTransport;
  now: () => number;
  /** Base connectivity (NetInfo). Forced offline is layered on top by the engine. */
  isOnline: () => boolean;
  /** Used for the backoff retry; defaults to `setTimeout`. Tests inject their own. */
  schedule?: (fn: () => void, delayMs: number) => void;
  batchSize?: number;
  pullPageSize?: number;
  /** Trailing debounce of `notifyLocalMutation()`; 500 ms unless a test shortens it. */
  debounceMs?: number;
  /** Called after every run settles and when forced-offline flips (the UI re-reads meals and state). */
  onChange?: () => void;
};

export type SyncEngine = {
  /** Swift `dispatch()`: one run (push the due batches, pull the pages); throws on failure. */
  dispatch(): Promise<DispatchResult>;
  /** UI-facing run: coalesces overlapping calls, turns typed failures into a status. */
  sync(): Promise<SyncResult>;
  /** Binds the engine to a user; waits for a previous owner's dispatch to drain first. */
  bind(owner: string): Promise<void>;
  /** Stops scheduling and drains any in-flight dispatch before resolving. */
  stop(): Promise<void>;
  currentOwner(): string | null;
  /** Trailing-edge debounce of a local write (500 ms), then a dispatch. */
  notifyLocalMutation(): void;
  /** Where the errors of background dispatches (debounce, retry timer, triggers) are reported. */
  setOnError(handler: ((error: unknown) => void) | null): void;
  setForcedOffline(value: boolean): void;
  isForcedOffline(): boolean;
  isOnline(): boolean;
  /** Result of the most recent finished run (`offline` before the first one). */
  lastResult(): SyncResult;
};

export const BATCH_SIZE = 50;
export const DEFAULT_DEBOUNCE_MS = 500;
/** Swift `maxOpAttempts`: after this many failed dispatches an operation is dead-lettered. */
export const MAX_OP_ATTEMPTS = 5;
const PULL_PAGE_SIZE = 200;

/** A dispatch that did nothing because another one ran or it was overtaken: never settles the status. */
const NOOP: DispatchResult = Object.freeze({ pushed: 0, acked: 0, pulled: 0, poisoned: 0, cursorAdvanced: false });

/** The dispatch was refused because the device is offline (the status shows `offline`; nothing was tried). */
const OFFLINE: DispatchResult = Object.freeze({ pushed: 0, acked: 0, pulled: 0, poisoned: 0, cursorAdvanced: false });

/** A 400 on the push: the batch is quarantined. */
type QuarantineDetails = { quarantined: true };

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const schedule = deps.schedule ?? ((fn, delayMs) => setTimeout(fn, delayMs));
  const batchSize = deps.batchSize ?? BATCH_SIZE;
  const pullPageSize = deps.pullPageSize ?? PULL_PAGE_SIZE;
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  let owner: string | null = null;
  let stopped = false;
  let generation = 0;
  let isDispatching = false;
  let trailingRequested = false;
  let isDraining = false;
  let drainWaiters: Array<() => void> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let debounceGeneration = 0;
  let errorSink: ((error: unknown) => void) | null = null;

  let forcedOffline = false;
  let lastResult: SyncResult = { status: 'offline', pushed: 0, pulled: 0 };
  let syncInFlight: Promise<SyncResult> | null = null;
  let syncFollowUp = false;
  let consecutiveFailures = 0;
  let retryToken = 0;
  let retryPending = false;

  const online = () => !forcedOffline && deps.isOnline();

  const reportError = (error: unknown): void => {
    errorSink?.(error);
  };

  const settle = (result: SyncResult): void => {
    lastResult = result;
    deps.onChange?.();
  };

  // ---- retry timer --------------------------------------------------------------------------

  const scheduleRetry = (): void => {
    if (retryPending) return; // one timer at a time; it re-reads the outbox when it fires
    retryPending = true;
    consecutiveFailures += 1;
    const delay = backoffDelayMs(consecutiveFailures);
    const token = retryToken;
    schedule(() => {
      if (token !== retryToken) return; // stop() or bind() overtook this timer
      retryPending = false;
      sync().catch(() => undefined); // an unexpected error is already on the error sink
    }, delay);
  };

  // ---- failure bookkeeping ------------------------------------------------------------------

  /**
   * A failed push or pull: every operation of the batch counts one attempt. The ones that reach
   * `MAX_OP_ATTEMPTS` are quarantined, the rest wait for the backoff of their attempt count.
   */
  const markBatchFailed = async (entries: OutboxEntry[], error: unknown): Promise<void> => {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = entries.filter((entry) => entry.attempts + 1 >= MAX_OP_ATTEMPTS);
    const retrying = entries.filter((entry) => entry.attempts + 1 < MAX_OP_ATTEMPTS);
    if (exhausted.length > 0) {
      await deps.store.quarantine(
        exhausted.map((entry) => entry.op.opId),
        message,
      );
    }
    if (retrying.length > 0) {
      const attempt = Math.max(...retrying.map((entry) => entry.attempts)) + 1;
      await deps.store.markAttempts(
        retrying.map((entry) => entry.op.opId),
        message,
        deps.now() + backoffDelayMs(attempt),
      );
    }
  };

  // ---- one dispatch -------------------------------------------------------------------------

  const asSyncError = (error: unknown): SyncError =>
    error instanceof SyncError ? error : new SyncError('transport', String(error), { cause: error });

  /**
   * Push the due batches, then pull the pages. Returns `NOOP` as soon as the generation moved on:
   * nothing after that point may touch the store on behalf of an owner that was stopped.
   */
  const runDispatch = async (gen: number): Promise<DispatchResult> => {
    let pushed = 0;
    let acked = 0;
    let poisoned = 0;
    let pulled = 0;
    let cursorAdvanced = false;

    // Push phase: a full batch that was acknowledged may be followed by more due operations.
    for (;;) {
      const due = await deps.store.dueOperations(batchSize, deps.now());
      if (gen !== generation) return NOOP;

      for (const stale of due.undecodable) {
        poisoned += 1;
        if (stale.attempts + 1 >= MAX_OP_ATTEMPTS) {
          await deps.store.quarantine([stale.opId], stale.reason);
        } else {
          await deps.store.markAttempts([stale.opId], stale.reason, deps.now() + backoffDelayMs(stale.attempts + 1));
        }
        if (gen !== generation) return NOOP;
      }

      // A stored operation that no longer satisfies the wire contract counts as undecodable too.
      const decodable: OutboxEntry[] = [];
      for (const entry of due.operations) {
        const parsed = SyncOperationSchema.safeParse(entry.op);
        if (parsed.success) {
          decodable.push(entry);
          continue;
        }
        poisoned += 1;
        const reason = 'the operation failed the wire contract';
        if (entry.attempts + 1 >= MAX_OP_ATTEMPTS) {
          await deps.store.quarantine([entry.op.opId], reason);
        } else {
          await deps.store.markAttempts([entry.op.opId], reason, deps.now() + backoffDelayMs(entry.attempts + 1));
        }
        if (gen !== generation) return NOOP;
      }

      if (decodable.length === 0) break;

      const operations: SyncOperation[] = decodable.map((entry) => entry.op);
      let response;
      try {
        response = await deps.transport.push(operations);
        if (gen !== generation) return NOOP;
        // No acknowledgement is applied before the complete submitted/acknowledged set matches.
        try {
          validateAcknowledgementSet(operations, response.accepted);
        } catch (cause) {
          throw new SyncError('server', cause instanceof Error ? cause.message : 'push acknowledgement set mismatch', {
            cause,
          });
        }
      } catch (error) {
        if (gen !== generation) return NOOP;
        const syncError = asSyncError(error);
        if (syncError.kind === 'unauthorized') throw syncError;
        if (syncError.kind === 'invalidRequest') {
          // 400: the request itself is invalid. Quarantine the batch with the error; human action needed.
          await deps.store.quarantine(
            operations.map((op) => op.opId),
            syncError.message,
          );
          throw new SyncError('invalidRequest', syncError.message, {
            details: { quarantined: true } satisfies QuarantineDetails,
            cause: syncError,
          });
        }
        await markBatchFailed(decodable, syncError);
        throw syncError;
      }

      const byOpId = new Map(response.accepted.map((ack) => [ack.opId, ack]));
      try {
        // One transaction per batch (spec D4).
        await deps.store.applyPushAcks(
          decodable.map((entry) => ({ op: entry.op, record: byOpId.get(entry.op.opId)!.record })),
        );
      } catch (error) {
        if (gen === generation) await markBatchFailed(decodable, error);
        throw error;
      }
      if (gen !== generation) return NOOP;
      pushed += operations.length;
      acked += response.accepted.length;

      // Fewer than a full batch means the outbox had nothing more that was due.
      if (due.operations.length + due.undecodable.length < batchSize) break;
    }

    // Pull phase: pages until `hasMore` is false.
    for (;;) {
      const cursor = await deps.store.cursor();
      if (gen !== generation) return NOOP;

      let page;
      try {
        page = await deps.transport.pull(cursor, pullPageSize);
        if (gen !== generation) return NOOP;
        try {
          // The cursor must not rewind and must reach every delivered version.
          validatePullResponse({
            rows: page.rows.map((row) => ({ snapshot: { serverVersion: row.record.serverVersion } })),
            cursor: page.cursor,
          });
          if (page.cursor < cursor) throw new Error('Pull cursor moved backwards');
        } catch (cause) {
          throw new SyncError('server', cause instanceof Error ? cause.message : 'invalid pull response', { cause });
        }
      } catch (error) {
        if (gen !== generation) return NOOP;
        throw asSyncError(error);
      }

      // One transaction per page (spec D4): skip pending intent, upsert, remove deleted, advance the
      // cursor — all or nothing.
      await deps.store.applyPullPage(page.rows, page.cursor);
      if (gen !== generation) return NOOP;
      pulled += page.rows.length;
      if (page.cursor !== cursor || page.rows.length > 0) cursorAdvanced = true;

      if (!page.hasMore) break;
    }

    return { pushed, acked, pulled, poisoned, cursorAdvanced };
  };

  const finishDispatch = (): void => {
    isDispatching = false;
    const waiters = drainWaiters;
    drainWaiters = [];
    for (const resume of waiters) resume();
  };

  const waitForDispatch = (): Promise<void> =>
    new Promise((resolve) => {
      drainWaiters.push(resolve);
    });

  /** Swift `dispatch()` without the bookkeeping for the status; settles nothing. */
  const dispatchInner = async (): Promise<DispatchResult> => {
    if (isDispatching) {
      trailingRequested = true;
      return NOOP;
    }
    if (stopped || owner === null) throw new SyncEngineError('notBound');
    if (!online()) return OFFLINE;

    generation += 1;
    const gen = generation;
    isDispatching = true;

    let result: DispatchResult;
    try {
      result = await runDispatch(gen);
    } catch (error) {
      finishDispatch();
      throw error;
    }
    finishDispatch();

    if (trailingRequested && !stopped && gen === generation) {
      trailingRequested = false;
      const trailing = await dispatchInner();
      return result.pushed === 0 ? trailing : result;
    }
    return result;
  };

  /** Turns a failure of a dispatch into the status the UI shows; null when it is not a typed failure. */
  const failureResult = (error: unknown): SyncResult | null => {
    if (error instanceof SyncEngineError && error.kind === 'notBound') {
      return { status: 'unauthorized', pushed: 0, pulled: 0, detail: error.message };
    }
    if (!(error instanceof SyncError)) return null;
    if (error.kind === 'unauthorized') return { status: 'unauthorized', pushed: 0, pulled: 0, detail: error.message };
    if (error.kind === 'invalidRequest') {
      const quarantined = (error.details as QuarantineDetails | undefined)?.quarantined === true;
      return { status: quarantined ? 'quarantined' : 'invalidRequest', pushed: 0, pulled: 0, detail: error.message };
    }
    return { status: 'retryScheduled', pushed: 0, pulled: 0, detail: error.message };
  };

  const dispatch = async (): Promise<DispatchResult> => {
    let result: DispatchResult;
    try {
      result = await dispatchInner();
    } catch (error) {
      const failure = failureResult(error);
      if (failure !== null) {
        settle(failure);
        if (failure.status === 'retryScheduled') scheduleRetry();
      }
      throw error;
    }
    if (result === OFFLINE) {
      settle({ status: 'offline', pushed: 0, pulled: 0 });
      return result;
    }
    if (result !== NOOP) {
      consecutiveFailures = 0;
      settle({
        status: 'synced',
        pushed: result.acked,
        pulled: result.pulled,
        ...(result.poisoned > 0 ? { detail: `${result.poisoned} operation(s) could not be decoded` } : {}),
      });
    }
    return result;
  };

  // ---- sync (UI-facing) ---------------------------------------------------------------------

  function sync(): Promise<SyncResult> {
    if (syncInFlight !== null) {
      // Coalesce into one follow-up run (spec D4); every caller of the in-flight run gets its result.
      syncFollowUp = true;
      return syncInFlight;
    }
    syncInFlight = (async (): Promise<SyncResult> => {
      try {
        await dispatch();
      } catch (error) {
        if (failureResult(error) === null) {
          reportError(error);
          throw error;
        }
      }
      return lastResult;
    })().finally(() => {
      syncInFlight = null;
      if (syncFollowUp) {
        syncFollowUp = false;
        sync().catch(() => undefined); // an unexpected error is already on the error sink
      }
    });
    return syncInFlight;
  }

  // ---- lifecycle ----------------------------------------------------------------------------

  const clearDebounce = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  const fireDebounce = async (gen: number, forOwner: string): Promise<void> => {
    if (gen !== debounceGeneration || stopped || forOwner !== owner) return;
    try {
      const result = await dispatch();
      if (result.poisoned > 0) reportError(new SyncEngineError('poisonedOperations', result.poisoned));
    } catch (error) {
      reportError(error);
    }
  };

  return {
    dispatch,
    sync,

    async stop() {
      stopped = true;
      owner = null;
      generation += 1;
      trailingRequested = false;
      retryToken += 1;
      retryPending = false;
      clearDebounce();
      debounceGeneration += 1;
      if (isDispatching) {
        isDraining = true;
        await waitForDispatch();
        isDraining = false;
      }
    },

    async bind(newOwner) {
      if (isDispatching || isDraining) await waitForDispatch();
      clearDebounce();
      debounceGeneration += 1;
      retryToken += 1;
      retryPending = false;
      consecutiveFailures = 0;
      stopped = false;
      owner = newOwner;
      generation += 1;
      trailingRequested = false;
    },

    currentOwner: () => owner,

    notifyLocalMutation() {
      if (stopped || owner === null) return;
      clearDebounce();
      debounceGeneration += 1;
      const gen = debounceGeneration;
      const forOwner = owner;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void fireDebounce(gen, forOwner);
      }, debounceMs);
    },

    setOnError(handler) {
      errorSink = handler;
    },

    setForcedOffline(value) {
      forcedOffline = value;
      deps.onChange?.();
    },
    isForcedOffline: () => forcedOffline,
    isOnline: online,
    lastResult: () => lastResult,
  };
}
