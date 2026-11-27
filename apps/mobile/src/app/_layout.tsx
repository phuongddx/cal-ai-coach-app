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
 * Where a guarded screen is sent. Without a `redirectTo`, expo-router sends a guarded screen to the
 * anchor (`(tabs)`), and when the anchor is guarded too, to the FIRST unguarded file route in alphabetical
 * order. That is `debug`, which sorts before `onboarding` and `sign-in` and is never guarded: a fresh
 * install landed on the Debug console (U-81). The navigator state is born from the launch URL (`/`, so
 * `(tabs)`) while the gate still shows the spinner, so the guard always has to move it: name the gate's
 * route as the destination of every group.
 */
const GATE_HOME = { wait: '/', 'sign-in': '/sign-in', onboarding: '/onboarding', shell: '/' } as const;

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
  const home = GATE_HOME[route];
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
          <Stack.Protected guard={route === 'sign-in'} redirectTo={home}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={route === 'onboarding'} redirectTo={home}>
            <Stack.Screen name="onboarding/index" />
          </Stack.Protected>
          <Stack.Protected guard={route === 'shell'} redirectTo={home}>
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
