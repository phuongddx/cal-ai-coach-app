/**
 * Sync triggers (spec D4): app start, app foreground, network regained
 * (NetInfo), 500 ms after a local write, and manual console actions.
 *
 * Only this file imports React Native / NetInfo / AppState; the engine and
 * the tests stay free of them.
 */
import { AppState } from 'react-native';
import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';

import type { SyncEngine } from './engine';

export type SyncTriggerHandle = {
  /** Cancels listeners and the pending debounce; safe to call twice. */
  stop: () => void;
};

export type TriggerDeps = {
  engine: SyncEngine;
  /** Wire connectivity; the engine layers forced-offline on top. */
  setNetConnected: (connected: boolean) => void;
};

const LOCAL_WRITE_DEBOUNCE_MS = 500;

export function startSyncTriggers(deps: TriggerDeps): SyncTriggerHandle {
  const { engine, setNetConnected } = deps;
  const unsubscribers: Array<() => void> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const fire = () => {
    void engine.sync();
  };

  const fireDebounced = () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fire();
    }, LOCAL_WRITE_DEBOUNCE_MS);
  };

  // App start.
  fire();

  // App foreground.
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') fire();
  });
  unsubscribers.push(() => appStateSub.remove());

  // Network regained (and lost: keeps the engine's isOnline() honest).
  const netInfoSub: NetInfoSubscription = NetInfo.addEventListener((state) => {
    const connected = state.isConnected ?? false;
    const wasOffline = !engine.isOnline();
    setNetConnected(connected);
    if (connected && wasOffline) fire();
  });
  unsubscribers.push(() => netInfoSub());

  // Seed the initial connectivity so isOnline() is correct before the first event.
  void NetInfo.fetch().then((state) => {
    setNetConnected(state.isConnected ?? false);
  });

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}

/** The trigger the repository's `onLocalWrite` calls (500 ms after a local write). */
export function createLocalWriteTrigger(engine: SyncEngine): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void engine.sync();
    }, LOCAL_WRITE_DEBOUNCE_MS);
  };
}
