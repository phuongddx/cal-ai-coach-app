/**
 * The sync engine (spec D4), injected with a `SyncStore` port, a
 * `SyncTransport` port, a clock and an `isOnline()` function, so it is
 * unit-tested without React Native.
 *
 * - `sync()`: push pending operations in FIFO batches of ≤ 50, then pull pages
 *   until `hasMore` is false.
 * - Transport/server failures keep the operations pending and schedule a
 *   backoff retry; a 400 quarantines the batch and stops; 401 stops.
 * - A sync already running coalesces into one follow-up run.
 * - `setForcedOffline(boolean)` makes `isOnline()` false without touching the
 *   server, so the offline path can be scripted.
 */
import type { MealRecord, SyncOperation } from '@coachcal/api-contract';

import { SyncError, type SyncStore, type SyncTransport } from './types';

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
  /** Records applied from the server. */
  pulled: number;
  detail?: string;
};

export type EngineDeps = {
  store: SyncStore;
  transport: SyncTransport;
  now: () => number;
  /** Base connectivity (NetInfo). Forced offline is layered on top by the engine. */
  isOnline: () => boolean;
  /** Used for the backoff retry; defaults to `setTimeout`. Test inject their own. */
  schedule?: (fn: () => void, delayMs: number) => void;
  batchSize?: number;
  pullPageSize?: number;
  /** Called after every run settles and when forced-offline flips (the UI re-reads meals and state). */
  onChange?: () => void;
};

export type SyncEngine = {
  sync(): Promise<SyncResult>;
  setForcedOffline(value: boolean): void;
  isForcedOffline(): boolean;
  isOnline(): boolean;
  /** Result of the most recent finished run (`offline` before the first one). */
  lastResult(): SyncResult;
};

const BATCH_SIZE = 50;
const PULL_PAGE_SIZE = 200;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const schedule = deps.schedule ?? ((fn, delayMs) => setTimeout(fn, delayMs));
  const batchSize = deps.batchSize ?? BATCH_SIZE;
  const pullPageSize = deps.pullPageSize ?? PULL_PAGE_SIZE;

  let forcedOffline = false;
  let inFlight: Promise<SyncResult> | null = null;
  let followUpPending = false;
  let lastResult: SyncResult = { status: 'offline', pushed: 0, pulled: 0 };
  let backoffAttempts = 0;

  const online = () => !forcedOffline && deps.isOnline();

  const scheduleRetry = (): void => {
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** backoffAttempts);
    backoffAttempts += 1;
    schedule(() => {
      void sync();
    }, delay);
  };

  /** Push one FIFO batch. Returns false when the phase must stop. */
  const pushBatch = async (result: SyncResult): Promise<boolean> => {
    const batch = await deps.store.pendingOperations(batchSize);
    if (batch.length === 0) return true;

    const operations = batch.map((entry) => entry.op);
    let response;
    try {
      response = await deps.transport.push(operations);
    } catch (error) {
      const syncError = error instanceof SyncError ? error : new SyncError('transport', String(error));
      if (syncError.kind === 'invalidRequest') {
        // 400: quarantine the batch with the error and stop. Human action needed.
        await deps.store.quarantine(
          operations.map((op) => op.opId),
          syncError.message,
        );
        result.status = 'quarantined';
        result.detail = syncError.message;
        return false;
      }
      if (syncError.kind === 'unauthorized') {
        result.status = 'unauthorized';
        result.detail = syncError.message;
        return false;
      }
      // transport | server | offline-ish: keep pending, retry with backoff.
      await deps.store.markAttempts(
        operations.map((op) => op.opId),
        syncError.message,
      );
      scheduleRetry();
      result.status = 'retryScheduled';
      result.detail = syncError.message;
      return false;
    }

    const byOpId = new Map(response.accepted.map((ack) => [ack.opId, ack]));
    const acked = operations
      .map((op) => {
        const ack = byOpId.get(op.opId);
        return ack === undefined ? null : { op, record: ack.record };
      })
      .filter((entry): entry is { op: SyncOperation; record: MealRecord } => entry !== null);

    // One transaction per batch (spec D4).
    await deps.store.applyPushAcks(acked);
    result.pushed += acked.length;

    // A shorter ack set is a server contract smell; stop and surface it.
    if (acked.length < operations.length) {
      const missing = operations.length - acked.length;
      await deps.store.markAttempts(
        operations.filter((op) => !byOpId.has(op.opId)).map((op) => op.opId),
        'no acknowledgement from server',
      );
      result.status = 'retryScheduled';
      result.detail = `${missing} operation(s) without an acknowledgement`;
      return false;
    }
    return true;
  };

  /** Pull pages until `hasMore` is false. Returns false when the phase must stop. */
  const pullPages = async (result: SyncResult): Promise<boolean> => {
    for (;;) {
      const cursor = await deps.store.cursor();
      let page;
      try {
        page = await deps.transport.pull(cursor, pullPageSize);
      } catch (error) {
        const syncError = error instanceof SyncError ? error : new SyncError('transport', String(error));
        if (syncError.kind === 'unauthorized') {
          result.status = 'unauthorized';
          result.detail = syncError.message;
          return false;
        }
        if (syncError.kind === 'invalidRequest') {
          result.status = 'invalidRequest';
          result.detail = syncError.message;
          return false;
        }
        // The cursor only advances inside the page transaction, so nothing to undo.
        scheduleRetry();
        result.status = 'retryScheduled';
        result.detail = syncError.message;
        return false;
      }

      // One transaction per page (spec D4): skip pending intent, upsert, remove
      // deleted, advance the cursor — all or nothing.
      await deps.store.applyPullPage(page.rows, page.cursor);
      result.pulled += page.rows.length;

      if (!page.hasMore) return true;
    }
  };

  const runOnce = async (): Promise<SyncResult> => {
    const result: SyncResult = { status: 'synced', pushed: 0, pulled: 0 };

    if (!online()) {
      return { status: 'offline', pushed: 0, pulled: 0 };
    }

    let keepGoing = await pushBatch(result);
    // A full batch came back acked: there may be more pending operations.
    while (keepGoing && result.pushed % batchSize === 0 && (await deps.store.pendingOperations(1)).length > 0) {
      keepGoing = await pushBatch(result);
    }
    if (keepGoing) {
      keepGoing = await pullPages(result);
    }
    if (keepGoing) {
      result.status = 'synced';
    }
    return result;
  };

  function sync(): Promise<SyncResult> {
    if (inFlight !== null) {
      // Coalesce into one follow-up run (spec D4); every caller of the
      // in-flight run gets its result.
      followUpPending = true;
      return inFlight;
    }
    inFlight = runOnce()
      .then((result) => {
        lastResult = result;
        deps.onChange?.();
        return result;
      })
      .finally(() => {
        inFlight = null;
        if (followUpPending) {
          followUpPending = false;
          void sync();
        }
      });
    return inFlight;
  }

  return {
    sync,
    setForcedOffline(value) {
      forcedOffline = value;
      deps.onChange?.();
    },
    isForcedOffline: () => forcedOffline,
    isOnline: online,
    lastResult: () => lastResult,
  };
}
