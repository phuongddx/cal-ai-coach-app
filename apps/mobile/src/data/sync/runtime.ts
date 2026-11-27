/**
 * The real sync runtime (spec D4: `getSyncRuntime()` wires the real store,
 * transport and triggers; the integration task calls them).
 *
 * `getSyncRuntime()` is async and memoized (opening SQLite and running the
 * migrations takes a moment); every later call returns the same runtime. No
 * native module is touched at import time, so importing this file in Jest
 * or under `tsc` is free.
 */
import { createFetchSyncTransport } from '../api/syncClient';
import { openLocalDb } from '../db/client';
import { createMealRepository, type MealRepository } from './repository';
import { createSqliteSyncStore } from './store.sqlite';
import { createLocalWriteTrigger, startSyncTriggers, type SyncTriggerHandle } from './triggers';
import { createSyncEngine, type SyncEngine } from './engine';
import type { SyncStore, SyncTransport } from './types';
import { newUuid } from './uuid';

export type SyncRuntime = {
  /** The app's one database handle; every repository is created over it (`src/data/environment.ts`). */
  db: Awaited<ReturnType<typeof openLocalDb>>['db'];
  engine: SyncEngine;
  repository: MealRepository;
  transport: SyncTransport;
  /** Exposed for the console's Sync card: cursor and outbox reads. */
  store: SyncStore;
  startTriggers: () => SyncTriggerHandle;
  /** Convenience for the console: fire and forget a sync. */
  syncNow: () => void;
  /** Re-reads for the UI, then schedules a sync; what `notifyLocalMutation` calls. */
  notifyLocalWrite: () => void;
  /** Fires after every sync run and every local write; returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
};

let runtimePromise: Promise<SyncRuntime> | null = null;

export function getSyncRuntime(): Promise<SyncRuntime> {
  runtimePromise ??= (async () => {
    const { db } = await openLocalDb();
    const store = createSqliteSyncStore(db);
    const transport = createFetchSyncTransport();

    const listeners = new Set<() => void>();
    const notify = () => listeners.forEach((listener) => listener());

    let netConnected = true;
    const engine = createSyncEngine({
      store,
      transport,
      now: () => Date.now(),
      isOnline: () => netConnected,
      onChange: notify,
    });
    const triggerSync = createLocalWriteTrigger(engine);
    const notifyLocalWrite = () => {
      notify();
      triggerSync();
    };
    const repository = createMealRepository({
      store,
      now: () => Date.now(),
      newId: newUuid,
      onLocalWrite: notifyLocalWrite,
    });

    return {
      db,
      engine,
      repository,
      transport,
      store,
      startTriggers: () =>
        startSyncTriggers({ engine, setNetConnected: (connected) => (netConnected = connected) }),
      syncNow: () => {
        void engine.sync();
      },
      notifyLocalWrite,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } satisfies SyncRuntime;
  })();
  return runtimePromise;
}

/**
 * What feature code calls after a write through a data repository (`src/data/repos/**`): the UI
 * re-reads and a sync is scheduled, as `notifyLocalMutation()` does in the Swift app.
 */
export function notifyLocalMutation(): void {
  void getSyncRuntime().then((runtime) => runtime.notifyLocalWrite());
}

/** Test hook: forget the memoized runtime. */
export function resetSyncRuntimeForTests(): void {
  runtimePromise = null;
}
