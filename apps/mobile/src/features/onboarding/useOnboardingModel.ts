import { useSyncExternalStore } from 'react';

import type { OnboardingModel } from './onboardingModel';

/**
 * Screens subscribe to the model's revision so a mutation re-renders — the RN
 * counterpart of SwiftUI reading an `@Observable` object. Every screen of the
 * flow calls this hook first, then reads the model's fields directly.
 */
export function useOnboardingModel(model: OnboardingModel): void {
  useSyncExternalStore(model.subscribe, model.getRevision);
}
