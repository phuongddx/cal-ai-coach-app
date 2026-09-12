import { View } from 'react-native';

import { FoundationSession } from '@/features/foundation/FoundationSession';

/**
 * Phase 1 walking-skeleton route: auth stub → owner-partitioned local SQLite
 * → repository → outbox → sync RPCs. Development-only surface, replaced by
 * product navigation in Phase 3.
 */
export default function Index() {
  return (
    <View className="flex-1 bg-surface-light dark:bg-surface-dark">
      <FoundationSession />
    </View>
  );
}
