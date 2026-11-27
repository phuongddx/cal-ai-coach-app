/**
 * The Today route (TD-01). The only file of the Today feature that touches the app's composition: the data
 * environment, the session store, the debug flags, the sync fan-out and the design ED-safe setter. It builds the
 * model's readers and hands them to `features/today` (standing-order rule 19).
 *
 * Launch arguments cannot be read on a device until U-51, so under `__DEV__` the route also takes query
 * parameters with the same meaning: `coachcal://?edSafe=1` turns ED-safe mode on for the session, and
 * `coachcal://?seed=1` seeds the demo persona once (SeedDataManager.ensureSeeded). U-51 replaces both.
 */
import { dayKey } from '@coachcal/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';

import { getSessionStore } from '../../data/auth';
import { getDataEnvironment } from '../../data/environment';
import { DEMO_USER_ID, createSeedDataManager } from '../../data/repos/seedDataManager';
import { isOfflineFrom } from '../../data/sync/offlineState';
import { getSyncRuntime, notifyLocalMutation, type SyncRuntime } from '../../data/sync/runtime';
import { useSyncState } from '../../data/binding';
import { getDebugFlags } from '../../debug/launchArgs';
import { setEdSafeMode } from '../../design';
import { TodayView } from '../../features/today/TodayView';
import { createTodayModel, type TodayModel } from '../../features/today/todayModel';
import { createTodayReaders } from '../../features/today/todayReaders';
import { writeFirstRender } from '../../spike/firstRender';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The sync runtime's subscribe, callable before the runtime resolves: early listeners wait for it. */
function makeRuntimeSubscribe(): (listener: () => void) => () => void {
  let runtime: SyncRuntime | null = null;
  const waiting: Array<{ listener: () => void; unsubscribe: (() => void) | null }> = [];
  void getSyncRuntime().then((resolved) => {
    runtime = resolved;
    for (const entry of waiting.splice(0)) {
      entry.unsubscribe = resolved.subscribe(entry.listener);
    }
  });
  return (listener) => {
    if (runtime !== null) return runtime.subscribe(listener);
    const entry: { listener: () => void; unsubscribe: (() => void) | null } = { listener, unsubscribe: null };
    waiting.push(entry);
    return () => {
      entry.unsubscribe?.();
      const index = waiting.indexOf(entry);
      if (index >= 0) waiting.splice(index, 1);
    };
  };
}

export default function TodayRoute() {
  const params = useLocalSearchParams<{ edSafe?: string; seed?: string }>();
  const edSafeParam = firstParam(params.edSafe);
  const seedParam = firstParam(params.seed);
  const sync = useSyncState();
  const [model, setModel] = useState<TodayModel | null>(null);

  // The development switches: the launch flag, plus the query parameter under __DEV__.
  useEffect(() => {
    if (getDebugFlags().edSafe) setEdSafeMode(true);
    if (__DEV__ && edSafeParam !== undefined) setEdSafeMode(edSafeParam === '1');
  }, [edSafeParam]);

  useEffect(() => {
    let mounted = true;
    let built: TodayModel | null = null;
    let released = false;
    // Disposes the model once, from whichever of the cleanup and the continuation gets there first: the
    // route can unmount before the environment resolves, and the model is built after that.
    const release = () => {
      if (built === null || released) return;
      released = true;
      built.dispose();
    };
    void (async () => {
      const environment = await getDataEnvironment();
      if (__DEV__ && seedParam === '1') {
        await createSeedDataManager(environment.db, { now: environment.now }).ensureSeeded();
        notifyLocalMutation();
      }
      built = createTodayModel({
        readers: createTodayReaders({
          db: environment.db,
          targets: environment.targets,
          tracking: environment.tracking,
          engagement: environment.engagement,
        }),
        addWater: (ml, day, owner, at) => environment.tracking.addWater(ml, day, owner, at),
        notify: notifyLocalMutation,
        subscribe: makeRuntimeSubscribe(),
        now: environment.now,
        ownerId: getSessionStore().getSession()?.user.id ?? DEMO_USER_ID,
      });
      await built.refresh();
      if (mounted) setModel(built);
      else release();
    })();
    return () => {
      mounted = false;
      release();
    };
  }, [seedParam]);

  useEffect(() => {
    writeFirstRender();
  }, []);

  const isOffline = useMemo(() => isOfflineFrom(sync.online, sync.lastStatus), [sync.online, sync.lastStatus]);

  if (model === null) return null;
  return (
    <TodayView
      model={model}
      isOffline={isOffline}
      onStartSetup={() => router.push('/onboarding')}
      onOpenDiary={(day) => router.push({ pathname: '/diary', params: { date: dayKey(day) } })}
      onOpenHealthSettings={() => void Linking.openSettings()}
    />
  );
}
