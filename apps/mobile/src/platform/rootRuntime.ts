/**
 * The real wiring of the launch sequence and the root gate: the app's database, session store, sync
 * runtime and data binding. Kept apart from the pure modules (`launchSequence.ts`,
 * `rootController.ts`) so Jest proves the rules without a native module; `_layout.tsx` is the only
 * caller. Nothing native runs at import time: every step opens its module when it is called.
 */
import { startDataBinding } from '../data/binding';
import { getSessionStore } from '../data/auth';
import { getDataEnvironment } from '../data/environment';
import { getSyncRuntime } from '../data/sync/runtime';
import { getDebugFlags, subscribeDebugFlags } from '../debug/launchArgs';
import { setEdSafeMode } from '../design/edSafe';
import { deleteAllRows } from './accountReset';
import { createRootController, type RootController, type RootControllerDeps } from './rootController';
import { clearStoredFlags, readStoredEdSafe } from './storedFlags';

/**
 * `--ccForceOffline` (Swift: `isOffline = true`, no path monitor): the sync engine reports offline and
 * makes no request while the flag is on. Applied at launch and again whenever the console flips it.
 */
function applyForcedOffline(): void {
  void getSyncRuntime()
    .then((runtime) => runtime.engine.setForcedOffline(getDebugFlags().forceOffline))
    .catch(() => undefined);
}

/** The steps of the launch sequence over the app's real modules. */
export function createRealRootDeps(): RootControllerDeps {
  return {
    flags: getDebugFlags,
    getSession: () => getSessionStore().getSession(),
    loadSession: () => getSessionStore().load(),
    readStoredEdSafe: async () => readStoredEdSafe((await getDataEnvironment()).db),
    setEdSafeMode,
    hasTarget: async (ownerIds) => {
      const { targets } = await getDataEnvironment();
      for (const owner of ownerIds) {
        if ((await targets.activeTarget(owner)) !== null) return true;
      }
      return false;
    },
    startDataBinding: () => {
      applyForcedOffline();
      return startDataBinding();
    },
    wipeLocalData: async () => {
      const runtime = await getSyncRuntime();
      await clearStoredFlags(runtime.db);
      await deleteAllRows(runtime.db);
      await runtime.store.reset();
    },
    subscribeSession: (listener) => getSessionStore().onChange(listener),
    subscribeFlags: (listener) =>
      subscribeDebugFlags(() => {
        applyForcedOffline();
        listener();
      }),
    subscribeLocalMutation: (listener) => {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;
      void getSyncRuntime().then((runtime) => {
        if (!cancelled) unsubscribe = runtime.subscribe(listener);
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  };
}

let controller: RootController | null = null;

/** The one root controller of the process, created on first use. */
export function getRootController(): RootController {
  controller ??= createRootController(createRealRootDeps());
  return controller;
}

/** Test hook: forget the controller. */
export function resetRootControllerForTests(): void {
  controller?.dispose();
  controller = null;
}
