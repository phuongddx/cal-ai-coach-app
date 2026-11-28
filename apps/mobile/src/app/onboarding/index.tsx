import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { getSessionStore } from '../../data/auth';
import { getDataEnvironment } from '../../data/environment';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import { notifyLocalMutation } from '../../data/sync/runtime';
import { writeAppSetting } from '../../data/repos/engagementRepository';
import { setEdSafeMode } from '../../design';
import { OnboardingFlowView } from '../../features/onboarding/OnboardingFlowView';
import { getRootController } from '../../platform/rootRuntime';
import { requestHealthAccess } from '../../features/onboarding/healthAccess';
import { createOnboardingModel } from '../../features/onboarding/onboardingModel';

/**
 * The onboarding route (RootView.swift's OnboardingFlowRoute). This file is the
 * only place that touches the real environment: it builds the model's
 * constructor dependencies — owner id (session user, else demo), clock, the
 * JIT HealthKit ask, the target save, `notifyLocalMutation`, and the step-7
 * ED-Safe switch's stored key + writer + design-flag setter (the route owns
 * the key literal, exactly as the Settings route does; the feature holds no
 * policy branch, invariant I7) — and hands the model to the flow. Finish
 * navigates to the Today tab with the typed route; the root gate of U-51
 * shows the shell once a target exists.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const model = useMemo(
    () =>
      createOnboardingModel({
        ownerId: getSessionStore().getSession()?.user.id ?? DEMO_USER_ID,
        now: () => new Date(),
        requestHealthAccess,
        saveTarget: async (target) => {
          (await getDataEnvironment()).targets.saveTarget(target);
        },
        notify: notifyLocalMutation,
        // The app-wide storage key: U-51 reads the same key at launch. The value
        // format is '1'/'0' — do not change either.
        policyStorageKey: 'edSafeMode',
        applyPolicyFlag: setEdSafeMode,
        writeSetting: async (key, value) => {
          await writeAppSetting((await getDataEnvironment()).db, key, value);
        },
      }),
    [],
  );
  return (
    <OnboardingFlowView
      model={model}
      onFinished={() => {
        // Mark onboarding complete first (Swift's completeOnboarding()): the gate then already has a
        // target, so the shell is unguarded when the navigation runs and the router does not bounce back.
        getRootController().completeOnboarding();
        router.replace('/');
      }}
    />
  );
}
