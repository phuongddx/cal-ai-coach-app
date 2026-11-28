import { useSyncExternalStore } from 'react';

import type { OnboardingModel, OnboardingSnapshot } from './onboardingModel';

/**
 * Screens subscribe to the model's published snapshot so a mutation re-renders — the RN counterpart of
 * SwiftUI reading an `@Observable` object. Every screen of the flow calls this hook first and draws
 * from the snapshot it returns; handlers keep calling the model. The snapshot is replaced on every
 * mutation, which the React Compiler needs: it memoizes reads of a mutable model.
 */
export function useOnboardingModel(model: OnboardingModel): OnboardingSnapshot {
  return useSyncExternalStore(model.subscribe, model.getSnapshot);
}
