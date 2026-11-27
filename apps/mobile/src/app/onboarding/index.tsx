import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { getSessionStore } from '../../data/auth';
import { getDataEnvironment } from '../../data/environment';
import { getDebugFlags } from '../../debug/launchArgs';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import { notifyLocalMutation } from '../../data/sync/runtime';
import { OnboardingFlowView } from '../../features/onboarding/OnboardingFlowView';
import { requestHealthAccess } from '../../features/onboarding/healthAccess';
import { createOnboardingModel } from '../../features/onboarding/onboardingModel';

/**
 * The onboarding route (RootView.swift's OnboardingFlowRoute). This file is the
 * only place that touches the real environment: it builds the model's
 * constructor dependencies — owner id (session user, else demo), clock,
 * `--ccDisableAnimations`, the JIT HealthKit ask, the target save and
 * `notifyLocalMutation` — and hands the model to the flow. Finish navigates to
 * the Today tab with the typed route; the root gate of U-51 shows the shell
 * once a target exists.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const model = useMemo(
    () =>
      createOnboardingModel({
        ownerId: getSessionStore().getSession()?.user.id ?? DEMO_USER_ID,
        now: () => new Date(),
        disableAnimations: getDebugFlags().disableAnimations,
        requestHealthAccess,
        saveTarget: async (target) => {
          (await getDataEnvironment()).targets.saveTarget(target);
        },
        notify: notifyLocalMutation,
      }),
    [],
  );
  return <OnboardingFlowView model={model} onFinished={() => router.replace('/')} />;
}
