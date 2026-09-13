/**
 * Contract types for the sync lifecycle scheduler. Split from the
 * implementation so consumers (and tests) can implement the platform adapters
 * without importing runtime code.
 */

export interface ClockAdapter {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface AppStateAdapter {
  addEventListener(
    type: 'change',
    listener: (state: string) => void
  ): () => void;
}

export interface NetInfoAdapter {
  addEventListener(
    listener: (state: { isConnected: boolean | null }) => void
  ): () => void;
}

export interface SyncLifecycleDeps {
  /** Runs one reconciliation pass for the given (bound) owner. */
  dispatch(ownerId: string): Promise<unknown>;
  clock?: ClockAdapter;
  appState?: AppStateAdapter;
  netInfo?: NetInfoAdapter;
  /** Debounce window for post-mutation signals. Default 500ms. */
  debounceMs?: number;
  /** Base delay for the exponential retry backoff. Default 1000ms. */
  retryBaseMs?: number;
}

export interface SyncLifecycleHandle {
  /**
   * The repository caller boundary requests a debounced flush after its local
   * transaction committed. Signals from a non-bound owner are ignored.
   */
  notifyLocalMutation(ownerId: string): void;
  /**
   * Detaches all events, cancels timers, and clears the bound owner. The
   * returned promise is the owner-handoff barrier: it resolves only after
   * the single active dispatch (if any) has settled, while every event
   * source is already incapable of scheduling another dispatch.
   */
  stop(): Promise<void>;
}
