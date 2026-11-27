/**
 * The scan flow route (SC-01). The only file of the feature that touches the app's composition: the data
 * environment, the session store, the debug flags and the sync fan-out (`notifyLocalMutation`). It builds the
 * model's dependencies and hands them to `features/scan`; nothing under that folder opens the database or reads
 * process arguments (standing-order rule 19).
 *
 * Fixture mode is on when the `scanScenario` or `fixtureCapture` flag is set. Launch arguments cannot be read on a
 * device until U-51, so under `__DEV__` the route also takes `scenario` and `capture` query parameters with the same
 * meaning (`coachcal://scan?scenario=402`). U-51 replaces them. `mode` and `meal` choose the opening mode and slot.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

import { getDataEnvironment } from '../../data/environment';
import { LiveScanApi, resolveBaseUrl, type CoachCalApi } from '../../data/api';
import { getSessionStore } from '../../data/auth';
import { createDiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import { fetchDiaryEntry } from '../../data/repos/diaryEntryRepository';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import { notifyLocalMutation } from '../../data/sync/runtime';
import { getDebugFlags } from '../../debug/launchArgs';
import { edSafeMode, useTokens } from '../../design';
import { ScanFlowView } from '../../features/scan/ScanFlowView';
import { noopScanActivity } from '../../features/scan/scanActivity';
import { createDeviceCaptureService, createFixtureCaptureService, type ScanCaptureService } from '../../features/scan/scanCapture';
import { createScanModel, type ScanModel } from '../../features/scan/scanModel';
import { createScanPersistence } from '../../features/scan/scanPersistence';
import { MEAL_SLOTS, type MealSlot, type ScanMode } from '../../features/scan/scanTypes';
import { FixtureScanApi, resolveFixtureScenario } from '../../testing';

const MODES: readonly ScanMode[] = ['photo', 'barcode', 'label', 'text'];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type Built = { model: ScanModel; fixtureMode: boolean };

async function buildModel(mealSlot: MealSlot, scenarioParam: string | undefined, forceFixture: boolean): Promise<Built> {
  const env = await getDataEnvironment();
  const flags = getDebugFlags();
  const store = getSessionStore();
  const ownerId = store.getSession()?.user.id ?? DEMO_USER_ID;
  const scenario = flags.scanScenario ?? scenarioParam ?? null;
  const fixtureMode = scenario !== null || flags.fixtureCapture || forceFixture;
  const api: CoachCalApi = fixtureMode
    ? new FixtureScanApi(resolveFixtureScenario(scenario === null ? [] : ['--ccScanScenario', scenario]))
    : new LiveScanApi({ auth: store.bearer, baseUrl: resolveBaseUrl() });
  const persistence = createScanPersistence({
    entries: env.diaryEntries,
    details: createDiaryDetailRepository(env.db),
    catalog: env.catalog,
    targets: env.targets,
    engagement: env.engagement,
    fetchEntry: (id) => fetchDiaryEntry(env.db, id),
    ownerId,
  });
  const model = createScanModel({
    api,
    ownerId,
    now: env.now,
    mealSlot,
    persistence,
    notify: notifyLocalMutation,
    activity: noopScanActivity,
    readIsEdSafe: edSafeMode,
  });
  return { model, fixtureMode };
}

export default function ScanRoute() {
  const router = useRouter();
  const { colors } = useTokens();
  const params = useLocalSearchParams<{ mode?: string; meal?: string; scenario?: string; capture?: string }>();
  const modeParam = firstParam(params.mode);
  const mealParam = firstParam(params.meal);
  const initialMode: ScanMode = MODES.find((mode) => mode === modeParam) ?? 'photo';
  const mealSlot: MealSlot = MEAL_SLOTS.find((slot) => slot === mealParam) ?? 'lunch';
  // The query parameters are a development convenience only; a release build ignores them.
  const scenarioParam = __DEV__ ? firstParam(params.scenario) : undefined;
  const forceFixture = __DEV__ && firstParam(params.capture) === 'fixture';

  const [built, setBuilt] = useState<Built | null>(null);
  useEffect(() => {
    let live = true;
    void buildModel(mealSlot, scenarioParam, forceFixture).then((result) => {
      if (live) setBuilt(result);
    });
    return () => {
      live = false;
    };
  }, [mealSlot, scenarioParam, forceFixture]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const createCapture = useCallback(
    (mode: ScanMode): ScanCaptureService => {
      const captureMode = mode === 'text' ? 'photo' : mode;
      return built?.fixtureMode ? createFixtureCaptureService(captureMode) : createDeviceCaptureService(captureMode);
    },
    [built],
  );

  if (built === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScanFlowView
      model={built.model}
      initialMode={initialMode}
      createCapture={createCapture}
      onClose={close}
      // FoodSearchRoute and AddFoodSheetRoute belong to other units; until they land both escapes close the flow.
      onSearchManually={close}
      onLogManually={close}
      onOpenSettings={() => void Linking.openSettings()}
      animationsDisabled={getDebugFlags().disableAnimations}
    />
  );
}
