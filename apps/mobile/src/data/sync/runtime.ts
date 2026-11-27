/**
 * The real sync runtime (spec D4: `getSyncRuntime()` wires the real store,
 * transport and triggers; the integration task calls them).
 *
 * The runtime runs on the signed-in user (SyncEngine bound to `session.user.id`, as `AppEnvironment`
 * does in the Swift app): the transport's token comes from the session store (refresh on a 401),
 * mirror rows carry the session's user id, the engine is bound at launch from the restored session,
 * on sign-in, and stopped on sign-out. With no session the engine stays unbound, makes no request and
 * reports `unauthorized`.
 *
 * Debug mode: when the app config names an `extra.apiToken` explicitly (a dev token for the local
 * API), and only then, the runtime acts for the demo owner with that token. Nothing is configured by
 * default, so a release build never sends a baked-in token.
 *
 * `getSyncRuntime()` is async and memoized (opening SQLite and running the
 * migrations takes a moment); every later call returns the same runtime. No
 * native module is touched at import time, so importing this file in Jest
 * or under `tsc` is free.
 */
import Constants from 'expo-constants';

import { createFetchSyncTransport } from '../api/syncClient';
import { getSessionStore } from '../auth';
import { openLocalDb } from '../db/client';
import { createMealRepository, type MealRepository } from './repository';
import { createSqliteSyncStore, LOCAL_OWNER_ID } from './store.sqlite';
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
let detachSession: (() => void) | null = null;

/** The explicit dev token of a debug configuration; null in every normal build. */
function debugApiToken(): string | null {
  const extra = Constants.expoConfig?.extra as { apiToken?: unknown } | undefined;
  return typeof extra?.apiToken === 'string' && extra.apiToken !== '' ? extra.apiToken : null;
}

export function getSyncRuntime(): Promise<SyncRuntime> {
  runtimePromise ??= (async () => {
    const { db } = await openLocalDb();
    const session = getSessionStore();
    // The keychain is read once at launch; a stored value that fails the contract is discarded.
    await session.load().catch(() => null);

    /** Who the engine acts for: the session's user, else the debug demo owner, else nobody. */
    const principal = (): string | null =>
      session.getSession()?.user.id ?? (debugApiToken() === null ? null : LOCAL_OWNER_ID);

    const store = createSqliteSyncStore(db, { ownerId: () => principal() ?? LOCAL_OWNER_ID });
    const transport = createFetchSyncTransport({
      tokenProvider: async () => (session.getSession() !== null ? session.getAccessToken() : debugApiToken()),
      refreshSession: async () => (session.getSession() !== null ? session.refresh() : false),
    });

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

    // Bind or stop the engine so its owner always equals the principal. Serialized: a stop drains
    // the in-flight dispatch before the next owner can bind.
    let binding: Promise<void> = Promise.resolve();
    const applyPrincipal = (): void => {
      binding = binding
        .then(async () => {
          const owner = principal();
          if (owner === engine.currentOwner()) return;
          if (engine.currentOwner() !== null) await engine.stop();
          if (owner === null) return;
          await engine.bind(owner);
          engine.sync().catch(() => undefined); // the first triggers fired while unbound
        })
        .catch(() => undefined);
    };
    detachSession?.();
    detachSession = session.onChange(applyPrincipal);
    applyPrincipal();

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
  detachSession?.();
  detachSession = null;
  runtimePromise = null;
}
