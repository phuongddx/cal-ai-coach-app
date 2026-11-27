/**
 * CCOfflineBadge (Components/Content.swift). Fixed "Offline — syncs later"
 * capsule.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { space, typography, useTokens } from '../tokens';

export const offlineBadgeLabel = 'Offline — syncs later';

export function OfflineBadge() {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={offlineBadgeLabel}
      testID="offline-badge"
      style={[styles.badge, { backgroundColor: colors.fill }]}
    >
      <SymbolView name="wifi.slash" size={11} tintColor={colors.text2} />
      <Text style={[styles.text, { color: colors.text2 }]}>{offlineBadgeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: 999,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  text: {
    ...typography.caption,
  },
});
