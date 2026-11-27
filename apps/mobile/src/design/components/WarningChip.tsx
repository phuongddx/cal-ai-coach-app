/**
 * CCWarningChip (Components/Content.swift). The review-needed chip. ED-safe
 * drops the kcal clause; the reason to review stays.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../tokens';

import { useEdSafeMode } from '../edSafe';

export type WarningChipProps = {
  reason: string;
  addedKcal?: number;
};

/** The pure ED-safe text rule, assertable without rendering (as in Swift). */
export function warningChipText(reason: string, addedKcal: number | undefined, edSafeMode: boolean): string {
  if (addedKcal == null) return reason;
  return edSafeMode
    ? `${reason} — review portion`
    : `${reason} — +${addedKcal} kcal added (editable)`;
}

export function WarningChip({ reason, addedKcal }: WarningChipProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  const text = warningChipText(reason, addedKcal, edSafeMode);
  return (
    <View
      accessible
      accessibilityLabel={text}
      testID="warning-chip"
      style={[
        styles.chip,
        { backgroundColor: colors.cautionTint },
      ]}
    >
      <SymbolView name="info.circle" size={14} tintColor={colors.cautionInk} />
      <Text style={[styles.text, { color: colors.cautionInk }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  text: {
    ...typography.footnote,
    fontWeight: '500',
    flex: 1,
  },
});
