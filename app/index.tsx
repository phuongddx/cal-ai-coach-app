import { View, Text } from 'react-native';

/**
 * Phase 1 walking-skeleton route.
 * Replaced in Plan 01-05 by the local-SQLite-backed screen; this placeholder
 * proves the router mounts and nothing more. No durable logic here.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-light dark:bg-surface-dark">
      <Text className="text-ink-light dark:text-ink-dark">CoachCal</Text>
    </View>
  );
}
