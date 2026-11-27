import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTokens } from '../design';
import { AppEnvironmentProvider } from '../platform/appEnvironment';
import { createAppEnvironment } from '../platform/appEnvironmentDeps';
import { getRootController } from '../platform/rootRuntime';
import { useRootGateRoute } from '../platform/useRootGate';
import { registerBuiltinSpikeActions } from '../spike/builtinActions';
import { startSpikeDeepLinks } from '../spike/deepLink';

registerBuiltinSpikeActions();

// The tabs are the home of the app; every other route is pushed over them.
export const unstable_settings = { anchor: '(tabs)' };

/**
 * The root gate (PL-01, `RootView.swift`). The launch sequence runs once at mount (session, stored
 * flags, target, data binding: `src/platform/launchSequence.ts`); until it is done the gate shows a
 * spinner. Then `decideRootGate` picks one of three groups of routes and `Stack.Protected` mounts only
 * that group, so a state change (sign-in, onboarding saved a target, an account reset) moves the
 * navigator without any route file knowing about the gate. The debug console stays reachable in every state.
 */
export default function RootLayout() {
  const router = useRouter();
  const controller = getRootController();
  const route = useRootGateRoute(controller);
  const { colors } = useTokens();
  const environment = useMemo(() => createAppEnvironment(() => router.push('/scan')), [router]);

  // Idempotent: a second effect run (StrictMode) returns the same launch promise.
  useEffect(() => {
    void controller.start();
  }, [controller]);
  // `coachcal://debug?action=<name>` runs a debug action (the route itself opens the console).
  useEffect(() => startSpikeDeepLinks(), []);

  return (
    <AppEnvironmentProvider value={environment}>
      <StatusBar style="auto" />
      {route === 'wait' ? (
        <View
          testID="root:loading"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={route === 'sign-in'}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={route === 'onboarding'}>
            <Stack.Screen name="onboarding/index" />
          </Stack.Protected>
          <Stack.Protected guard={route === 'shell'}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="diary" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
            <Stack.Screen name="settings" />
          </Stack.Protected>
          <Stack.Screen name="debug" options={{ headerShown: true, title: 'Debug console' }} />
        </Stack>
      )}
    </AppEnvironmentProvider>
  );
}
