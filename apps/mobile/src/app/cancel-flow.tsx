/**
 * The cancel-flow route (U-77, `coachcal://cancel-flow`): it binds the
 * informational screen's two exits. The primary opens the App Store's
 * subscriptions page through `Linking` — the in-app manage-subscriptions sheet
 * needs a native module that does not exist yet (decision D14). The route's
 * tests live beside the screens in the feature, never under src/app.
 */
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { CancelFlowView } from '../features/billing/CancelFlowView';

/** Apple's subscriptions page (manage-subscriptions' web equivalent, D14). */
const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export default function CancelFlowRoute() {
  const router = useRouter();

  return (
    <CancelFlowView
      onContinue={() => {
        // The URL scheme is https — a failure to open (no browser) leaves the
        // screen up; the catch keeps the rejection unhandled-free.
        void Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL).catch(() => undefined);
      }}
      onKeep={() => router.back()}
    />
  );
}
