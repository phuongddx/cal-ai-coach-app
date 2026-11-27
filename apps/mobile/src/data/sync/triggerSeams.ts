/**
 * SyncTriggers.swift — each system scheduling signal reduced to one engine-side action. Nothing here
 * imports React Native: the seams take the `AppState` / `NetInfo` objects as arguments, so Jest drives
 * them with plain fakes and `triggers.ts` hands them the real modules.
 */

/** A system scheduling signal reduced to one action (Swift `SyncTriggering`). */
export interface SyncTriggering {
  fire(): void;
}

export type SyncFireAction = () => void;

/** The part of `AppState` the foreground trigger needs. */
export type AppStateSource = {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
};

/** The part of NetInfo the network trigger needs. */
export type NetInfoSource = {
  addEventListener(listener: (state: { isConnected: boolean | null }) => void): () => void;
};

/** Fires when the app becomes active (Swift `ForegroundTrigger`: `didBecomeActive`). */
export class ForegroundTrigger implements SyncTriggering {
  constructor(private readonly fireAction: SyncFireAction) {}

  fire(): void {
    this.fireAction();
  }

  /** Returns the function that cancels the observation. */
  start(appState: AppStateSource): () => void {
    const subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') this.fire();
    });
    return () => subscription.remove();
  }
}

/**
 * Network-reachability trigger (Swift `NWPathTrigger`). `start` emits only on a rising edge: the
 * network was not connected and now is. A repeated "connected" event does not fire again.
 */
export class NetworkTrigger implements SyncTriggering {
  constructor(private readonly fireAction: SyncFireAction) {}

  fire(): void {
    this.fireAction();
  }

  /**
   * @param onConnectivity called with every reading, so the engine's `isOnline()` stays honest.
   * @returns the function that cancels the observation.
   */
  start(netInfo: NetInfoSource, onConnectivity?: (connected: boolean) => void): () => void {
    let wasConnected = false;
    return netInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      onConnectivity?.(connected);
      const previous = wasConnected;
      wasConnected = connected;
      if (connected && !previous) this.fire();
    });
  }
}

/**
 * Background-task boundary (Swift `BGTaskTrigger`). Registration and the OS launch handling belong to
 * the app shell; this seam only wraps the submission and maps a launch to the normal fire action.
 * The RN app has no background task yet (U-?? owns that), so nothing constructs it outside the tests.
 */
export class BGTaskTrigger implements SyncTriggering {
  constructor(
    private readonly fireAction: SyncFireAction,
    private readonly submitAction: () => void = () => undefined,
  ) {}

  fire(): void {
    this.fireAction();
  }

  submit(): void {
    this.submitAction();
    this.fire();
  }
}
