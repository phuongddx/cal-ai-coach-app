/**
 * CCSettingsRow (Components/Cards.swift). Icon, label, optional value, chevron.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { space, typography, useTokens } from '../tokens';

export type SettingsRowProps = {
  icon: string;
  label: string;
  value?: string;
};

export function settingsA11yLabel(label: string, value?: string): string {
  return value == null ? label : `${label}, ${value}`;
}

export function SettingsRow({ icon, label, value }: SettingsRowProps) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={settingsA11yLabel(label, value)}
      testID={`settings-row:${label}`}
      style={styles.row}
    >
      <SymbolView name={icon} size={20} tintColor={colors.textSecondary} />
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      {value != null && (
        <Text style={[styles.value, { color: colors.textSecondary }]}>{value}</Text>
      )}
      <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  label: {
    ...typography.subhead,
    flexGrow: 1,
  },
  value: {
    ...typography.subhead,
  },
});
