/**
 * CCSettingsRow (Components/Cards.swift). Icon, label, optional value, chevron.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { space, typography, useTokens, type Colors } from '../tokens';

export type SettingsRowProps = {
  icon: string;
  label: string;
  value?: string;
  /** Show the trailing chevron. Default true; a row without an action turns it off. */
  chevron?: boolean;
  /** Semantic ink of the value (`success` for "Connected"). Default: the secondary text color. */
  tint?: SettingsValueTint;
};

export type SettingsValueTint = 'success' | 'caution' | 'error' | 'info' | 'accent';

export function settingsValueColor(colors: Colors, tint?: SettingsValueTint): string {
  switch (tint) {
    case 'success':
      return colors.successInk;
    case 'caution':
      return colors.cautionInk;
    case 'error':
      return colors.errorInk;
    case 'info':
      return colors.infoInk;
    case 'accent':
      return colors.accentInk;
    default:
      return colors.text2;
  }
}

export function settingsA11yLabel(label: string, value?: string): string {
  return value == null ? label : `${label}, ${value}`;
}

export function SettingsRow({ icon, label, value, chevron = true, tint }: SettingsRowProps) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={settingsA11yLabel(label, value)}
      testID={`settings-row:${label}`}
      style={styles.row}
    >
      <SymbolView name={icon as SFSymbol} size={20} tintColor={colors.text2} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {value != null && (
        <Text style={[styles.value, { color: settingsValueColor(colors, tint) }]}>{value}</Text>
      )}
      {chevron && (
        <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.text3} />
      )}
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
