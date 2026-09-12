import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db } from '@/db/client';
import { migrationsBundle } from '@/db/migrations';
import { initializeTelemetry } from '@/lib/telemetry';

/**
 * Migration gate: no durable route mounts until the bundled SQLite migration
 * journal has applied. A failure blocks the app (Plan 01-02 T-01-09: controlled
 * reset is the recovery, never silent partial execution).
 */
export default function RootLayout() {
  useEffect(() => {
    initializeTelemetry();
  }, []);

  const { success, error } = useMigrations(db, migrationsBundle);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark">
        <Text className="text-ink-light dark:text-ink-dark">
          Local database failed to initialize.
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark">
        <Text className="text-ink-light dark:text-ink-dark">Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
