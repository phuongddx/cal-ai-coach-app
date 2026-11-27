/**
 * The diary route (DY-01): the day sheet, presented as a formSheet from Today
 * and through `coachcal://diary`. This is the only file of the diary feature
 * that touches the data seams — it builds the models' dependency bundle and
 * hands it to the feature's factories (standing-order rule 19). The route's
 * tests live beside the screens in the feature, never under src/app.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { getSessionStore } from '../data/auth';
import { createDiaryDetailRepository } from '../data/repos/diaryDetailRepository';
import { DEMO_USER_ID } from '../data/repos/seedDataManager';
import { getDataEnvironment } from '../data/environment';
import { getSyncRuntime, notifyLocalMutation } from '../data/sync/runtime';
import { newUuid } from '../data/sync/uuid';
import type { SyncRuntime } from '../data/sync/runtime';

import { linkDate } from '../features/diary/diaryMath';
import { createDiaryDayModel } from '../features/diary/diaryDayModel';
import type { DiaryDeps } from '../features/diary/deps';
import { DiaryDayView } from '../features/diary/screens/DiaryDayView';
import type { ScanMode } from '../features/diary/addFoodModel';

type DiarySession = {
  deps: DiaryDeps;
  model: ReturnType<typeof createDiaryDayModel>;
};

/**
 * The sync runtime's subscribe, callable before the runtime resolves: early
 * listeners wait for the runtime, then ride its re-read signal.
 */
function makeRuntimeSubscribe(): DiaryDeps['subscribe'] {
  let runtime: SyncRuntime | null = null;
  const waiting: Array<{ listener: () => void; unsubscribe: (() => void) | null }> = [];
  void getSyncRuntime().then((resolved) => {
    runtime = resolved;
    for (const entry of waiting.splice(0)) {
      entry.unsubscribe = resolved.subscribe(entry.listener);
    }
  });
  return (listener: () => void) => {
    if (runtime !== null) {
      return runtime.subscribe(listener);
    }
    const entry: { listener: () => void; unsubscribe: (() => void) | null } = { listener, unsubscribe: null };
    waiting.push(entry);
    return () => {
      entry.unsubscribe?.();
      const index = waiting.indexOf(entry);
      if (index >= 0) {
        waiting.splice(index, 1);
      }
    };
  };
}

export default function DiaryScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const navigation = useNavigation();
  const [session, setSession] = useState<DiarySession | null>(null);

  // The frame's detents (medium + large) are a native sheet option, so they
  // belong here in the route file, not in the view (U-71 findings).
  useEffect(() => {
    navigation.setOptions({ sheetAllowedDetents: [0.5, 1] });
  }, [navigation]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const environment = await getDataEnvironment();
      // WR-08: ?date= picks the local day (noon-anchored); anything else is today.
      const day = linkDate(params.date) ?? new Date();
      const deps: DiaryDeps = {
        db: environment.db,
        catalog: environment.catalog,
        diaryEntries: environment.diaryEntries,
        diaryDetails: createDiaryDetailRepository(environment.db),
        targets: environment.targets,
        tracking: environment.tracking,
        notify: notifyLocalMutation,
        ownerId: getSessionStore().getSession()?.user.id ?? DEMO_USER_ID,
        subscribe: makeRuntimeSubscribe(),
        now: environment.now,
        newId: newUuid,
      };
      const model = createDiaryDayModel(deps, day);
      await model.refresh();
      if (mounted) {
        setSession({ deps, model });
      }
    })();
    return () => {
      mounted = false;
    };
    // The day query runs once per presentation; the sheet re-opens for another day.
  }, []);

  const onCapture = useMemo(
    () => (mode: ScanMode) => {
      // The Swift hand-over dismisses the diary sheet, then opens the scan flow.
      router.dismiss();
      router.push({ pathname: '/scan', params: { mode } });
    },
    [],
  );

  if (session === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // One wrapping View: a formSheet whose only child is the day ScrollView (plus the two Modals the view
  // adds as siblings) trips react-native-screens' "FormSheet with ScrollView expects at most 2
  // subviews" layout path and renders blank (U-33 findings, flow 04). `collapsable={false}` keeps Fabric
  // from flattening the wrapper away, which would put the ScrollView back as the direct child.
  return (
    <View style={{ flex: 1 }} collapsable={false}>
      <DiaryDayView model={session.model} deps={session.deps} onCapture={onCapture} />
    </View>
  );
}
