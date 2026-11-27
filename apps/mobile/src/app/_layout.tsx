import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { startDataBinding } from '../data/binding';
import { registerBuiltinSpikeActions } from '../spike/builtinActions';
import { startSpikeDeepLinks } from '../spike/deepLink';

registerBuiltinSpikeActions();

// The tabs are the home of the app; every other route is pushed over them.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  // `coachcal://debug?action=<name>` runs a debug action (the route itself opens the console).
  useEffect(() => startSpikeDeepLinks(), []);
  // Sync triggers, widget foreground reload, SQLite -> Today/widget binding.
  useEffect(() => startDataBinding(), []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="diary" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="debug" options={{ headerShown: true, title: 'Debug console' }} />
      </Stack>
    </>
  );
}
