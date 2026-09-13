import type { SyncLifecycleDeps as Deps } from './lifecycleTypes';

/**
 * App lifecycle, reconnect, and post-mutation scheduling bridge
 * (Plan 01-04 Task 3).
 *
 * All platform effects are injected (AppState, NetInfo, clock) so the
 * scheduling logic is deterministically testable and this module never imports
 * native modules directly — the app shell (Plan 01-05) supplies the real
 * adapters after the migration gate succeeds.
 *
 * Guarantees:
 * - one dispatch attempt at start, foreground, reconnect, and debounced
 *   post-mutation signals;
 * - single-flight: triggers never create concurrent dispatch runs;
 * - a failed dispatch schedules an exponential-backoff retry;
 * - stop() detaches everything and clears the bound owner — a later event can
 *   never dispatch under the previous owner's identity.
 */

export type {
  SyncLifecycleDeps,
  SyncLifecycleHandle,
} from './lifecycleTypes';
import type {
  AppStateAdapter,
  NetInfoAdapter,
  ClockAdapter,
  SyncLifecycleDeps,
  SyncLifecycleHandle,
} from './lifecycleTypes';

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_RETRY_BASE_MS = 1000;
const MAX_RETRY_MS = 30_000;

export function startSyncLifecycle(
  ownerId: string,
  deps: SyncLifecycleDeps
): SyncLifecycleHandle {
  const clock: ClockAdapter =
    deps.clock ??
    ({
      setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id) => clearTimeout(id as never),
    } satisfies ClockAdapter);
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const retryBaseMs = deps.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;

  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let rerunQueued = false;
  let debounceTimer: number | null = null;
  let retryTimer: number | null = null;
  let retryDelay = retryBaseMs;
  const unsubscribers: (() => void)[] = [];

  function scheduleRun(): void {
    if (stopped) return;
    if (inFlight) {
      // A run is active; request exactly one trailing rerun.
      rerunQueued = true;
      return;
    }
    inFlight = runOnce();
  }

  async function runOnce(): Promise<void> {
    try {
      await deps.dispatch(ownerId);
      retryDelay = retryBaseMs;
    } catch (error) {
      // Failure is observable (logged); the queue is intact. Schedule a
      // backoff retry for this owner.
      console.warn(
        '[sync-dispatch-failed]',
        error instanceof Error ? error.message : error
      );
      if (!stopped) {
        retryTimer = clock.setTimeout(scheduleRun, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      }
    }
    inFlight = null;
    if (rerunQueued && !stopped) {
      rerunQueued = false;
      scheduleRun();
    }
  }

  function scheduleDebounced(): void {
    if (stopped) return;
    if (debounceTimer !== null) clock.clearTimeout(debounceTimer);
    debounceTimer = clock.setTimeout(() => {
      debounceTimer = null;
      scheduleRun();
    }, debounceMs);
  }

  // Initial attempt for the bound owner.
  scheduleRun();

  if (deps.appState) {
    const appState: AppStateAdapter = deps.appState;
    const onAppState = (state: string) => {
      if (state === 'active') scheduleRun();
    };
    unsubscribers.push(appState.addEventListener('change', onAppState));
  }

  if (deps.netInfo) {
    const netInfo: NetInfoAdapter = deps.netInfo;
    let wasConnected: boolean | null = null;
    const onNetwork = (state: { isConnected: boolean | null }) => {
      const connected = state.isConnected === true;
      if (wasConnected === false && connected) scheduleRun();
      wasConnected = connected;
    };
    unsubscribers.push(netInfo.addEventListener(onNetwork));
  }

  return {
    notifyLocalMutation(mutatingOwner: string): void {
      if (stopped || mutatingOwner !== ownerId) return;
      scheduleDebounced();
    },
    stop(): void {
      stopped = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers.length = 0;
      if (debounceTimer !== null) {
        clock.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (retryTimer !== null) {
        clock.clearTimeout(retryTimer);
        retryTimer = null;
      }
      rerunQueued = false;
      const pending = inFlight;
      inFlight = null;
      // Best-effort drain: a run in progress finishes against the old owner's
      // state, but no new run can ever start for it after stop().
      void pending?.catch(() => undefined);
    },
  };
}
