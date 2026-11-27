/**
 * Integration (spec D5): binds the SQLite repository to what the user sees.
 *
 * - Ember shows today's meals read from the repository (`emberStore.setMeals`), and its offline chip
 *   follows the sync engine (forced offline, or the last run could not reach the server).
 * - The widget receives a snapshot whenever today's totals change (`publish`).
 * - The console's Sync card reads `useSyncState()` (outbox, cursor, online state).
 *
 * Everything is re-read after each sync run, local write and console action, so a pull that rewrote
 * a meal (item 4 step 5) shows up without a manual refresh.
 */
import { useSyncExternalStore } from 'react';

import { fixtureTargets, type EmberMeal } from '../features/ember/fixture';
import { setEmberState } from '../features/ember/emberStore';
import { subscribeSpike } from '../spike/registry';
import { spikeLog } from '../spike/spikeLog';
import { snapshotFromMeals } from './widget/snapshotFromMeals';
import { publish, startForegroundReload } from './widget/WidgetSnapshotPublisher';
import { isOfflineFrom } from './sync/offlineState';
import { getSessionStore } from './auth';
import { getDataEnvironment } from './environment';
import { DEMO_USER_ID } from './repos/seedDataManager';
import { getSyncRuntime, type SyncRuntime } from './sync/runtime';
import type { LocalMeal } from './sync/types';

export type SyncStateSnapshot = {
  ready: boolean;
  online: boolean;
  forcedOffline: boolean;
  lastStatus: string;
  outbox: number;
  cursor: number;
  quarantined: number;
  meals: number;
};

const initialState: SyncStateSnapshot = {
  ready: false,
  online: true,
  forcedOffline: false,
  lastStatus: 'not started',
  outbox: 0,
  cursor: 0,
  quarantined: 0,
  meals: 0,
};

let syncState: SyncStateSnapshot = initialState;
const listeners = new Set<() => void>();

export function getSyncState(): SyncStateSnapshot {
  return syncState; // replaced, never mutated: a stable snapshot for useSyncExternalStore
}

function subscribeSyncState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncState(): SyncStateSnapshot {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}

const toEmberMeal = (m: LocalMeal): EmberMeal => ({
  id: m.id,
  eatenAt: m.eatenAt,
  name: m.name,
  kcal: m.kcal,
  proteinG: m.proteinG,
  carbsG: m.carbsG,
  fatG: m.fatG,
  fiberG: m.fiberG,
  updatedAt: m.updatedAt,
});

let lastPublished = '';

/** The widget's goals: the active target of the local store (what Today shows), else the spike fixture. */
async function widgetGoals() {
  try {
    const target = await (await getDataEnvironment()).targets.activeTarget(getSessionStore().getSession()?.user.id ?? DEMO_USER_ID);
    if (target !== null) {
      return { kcal: target.dailyKcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG };
    }
  } catch {
    // The store is not readable yet: fall back to the fixture goals below.
  }
  return fixtureTargets;
}

async function refresh(runtime: SyncRuntime): Promise<void> {
  const [rows, outbox, cursor, quarantined] = await Promise.all([
    runtime.repository.listMeals(),
    runtime.store.outboxCount(),
    runtime.store.cursor(),
    runtime.store.quarantinedOperations(),
  ]);
  const meals = rows.filter((m) => !m.deleted).map(toEmberMeal);
  const online = runtime.engine.isOnline();
  const lastStatus = runtime.engine.lastResult().status;

  setEmberState({ meals, isOffline: isOfflineFrom(online, lastStatus) });
  syncState = {
    ready: true,
    online,
    forcedOffline: runtime.engine.isForcedOffline(),
    lastStatus,
    outbox,
    cursor,
    quarantined: quarantined.length,
    meals: meals.length,
  };
  listeners.forEach((l) => l());

  const snapshot = snapshotFromMeals(meals, await widgetGoals(), new Date());
  const key = JSON.stringify(snapshot);
  if (key !== lastPublished) {
    lastPublished = key;
    publish(snapshot, { log: (event, data) => spikeLog('widget', event, data) });
  }
}

/**
 * Starts the sync triggers, the widget's foreground reload and the data binding. Returns a stop
 * function. Safe to call before the SQLite runtime is open: it awaits it.
 */
export function startDataBinding(): () => void {
  let stopped = false;
  const stops: Array<() => void> = [];
  const widgetReload = startForegroundReload({ log: (event, data) => spikeLog('widget', event, data) });
  stops.push(() => widgetReload.remove());

  void (async () => {
    try {
      const runtime = await getSyncRuntime();
      if (stopped) return;
      let chain: Promise<void> = Promise.resolve();
      const queueRefresh = () => {
        // Serialized so a slow read never overwrites a newer one.
        chain = chain.then(() => refresh(runtime)).catch((e) => spikeLog('sync', 'refresh-failed', { message: String(e) }));
      };
      stops.push(runtime.subscribe(queueRefresh));
      stops.push(subscribeSpike(queueRefresh));
      const triggers = runtime.startTriggers();
      stops.push(() => triggers.stop());
      queueRefresh();
      spikeLog('sync', 'binding-started', {});
    } catch (e) {
      spikeLog('sync', 'binding-failed', { message: e instanceof Error ? e.message : String(e) });
    }
  })();

  return () => {
    stopped = true;
    stops.forEach((s) => s());
  };
}
