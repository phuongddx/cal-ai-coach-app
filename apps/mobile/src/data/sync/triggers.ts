/**
 * Sync triggers (spec D4): app start, app foreground, network regained (NetInfo), 500 ms after a local
 * write (the engine's own debounce) and manual console actions.
 *
 * Only this file imports React Native / NetInfo / AppState; the engine, the seams
 * (`triggerSeams.ts`) and the tests stay free of them.
 */
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import type { SyncEngine } from './engine';
import { ForegroundTrigger, NetworkTrigger, type NetInfoSource } from './triggerSeams';

export type SyncTriggerHandle = {
  /** Cancels listeners; safe to call twice. */
  stop: () => void;
};

export type TriggerDeps = {
  engine: SyncEngine;
  /** Wire connectivity; the engine layers forced-offline on top. */
  setNetConnected: (connected: boolean) => void;
};

export function startSyncTriggers(deps: TriggerDeps): SyncTriggerHandle {
  const { engine, setNetConnected } = deps;
  const unsubscribers: Array<() => void> = [];
  let stopped = false;

  // `sync()` already puts an unexpected error on the engine's error sink.
  const fire = () => {
    engine.sync().catch(() => undefined);
  };

  // App start.
  fire();

  // App foreground.
  unsubscribers.push(new ForegroundTrigger(fire).start(AppState));

  // Network regained (rising edge only); every reading keeps the engine's isOnline() honest.
  unsubscribers.push(new NetworkTrigger(fire).start(NetInfo as NetInfoSource, setNetConnected));

  // Seed the initial connectivity so isOnline() is correct before the first event.
  void NetInfo.fetch().then((state) => {
    setNetConnected(state.isConnected ?? false);
  });

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}

/** The trigger the repository's `onLocalWrite` calls: the engine's 500 ms trailing debounce. */
export function createLocalWriteTrigger(engine: SyncEngine): () => void {
  return () => engine.notifyLocalMutation();
}
