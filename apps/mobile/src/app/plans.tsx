/**
 * The paywall route (U-77, `coachcal://plans`): it builds the paywall model's
 * real seams and hands the screen over (standing-order rule 19). This build
 * connects no store — the loader always rejects, so the screen always ends in
 * the failed state ("Prices didn't load") and never shows a price (D13);
 * restore is a no-op resolve until the store's native port lands. The route's
 * tests live beside the screens in the feature, never under src/app.
 */
import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { PaywallView } from '../features/billing/PaywallView';
import { createPaywallModel, type PlanOption } from '../features/billing/paywallModel';

/** The store read this build cannot make: no store module exists (PL-16). */
async function loadStoreOptions(): Promise<readonly PlanOption[]> {
  throw new Error('No store is connected in this build.');
}

export default function PlansRoute() {
  const router = useRouter();
  const model = useMemo(
    () =>
      createPaywallModel({
        loadOptions: loadStoreOptions,
        // `AppStore.sync()`'s equivalent needs the store's native module (D14
        // follow-up); the button works and resolves honestly for now.
        restore: async () => undefined,
        purchase: async () => {
          throw new Error('No store is connected in this build.');
        },
      }),
    [],
  );

  return <PaywallView model={model} onClose={() => router.back()} />;
}
