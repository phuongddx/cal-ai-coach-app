/**
 * CCOptionCard (Components/Controls.swift). Selectable option row with icon
 * tile; the selected/unselected visual state mapping is exposed for contract
 * tests exactly as in Swift.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { radius, space, typography, useTokens, type Colors } from '../tokens';

export type OptionCardProps = {
  title: string;
  subtitle?: string;
  icon: string;
  isSelected: boolean;
  onSelect?: () => void;
};

// Exposed for contract tests: the selected/unselected visual state mapping.
export function optionCardBorder(colors: Colors, isSelected: boolean): { width: number; color: string } {
  return isSelected ? { width: 2, color: colors.accentStrong } : { width: 1, color: colors.border };
}

export function optionCardIconTile(colors: Colors, isSelected: boolean): string {
  return isSelected ? colors.accentTint : colors.fill;
}

export function optionCardIconColor(colors: Colors, isSelected: boolean): string {
  return isSelected ? colors.accentInk : colors.text2;
}

export function optionCardA11yLabel(title: string, subtitle: string | undefined, isSelected: boolean): string {
  return `${title}${subtitle != null ? `, ${subtitle}` : ''}, ${isSelected ? 'selected' : 'not selected'}`;
}

export function OptionCard({ title, subtitle, icon, isSelected, onSelect }: OptionCardProps) {
  const { colors } = useTokens();
  const border = optionCardBorder(colors, isSelected);
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={optionCardA11yLabel(title, subtitle, isSelected)}
      accessibilityState={{ selected: isSelected }}
      testID={`option-card:${title}`}
      onPress={onSelect}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderWidth: border.width,
          borderColor: border.color,
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: optionCardIconTile(colors, isSelected) }]}>
        <SymbolView name={icon as SFSymbol} size={20} tintColor={optionCardIconColor(colors, isSelected)} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, { color: colors.text2 }]}>{subtitle}</Text>
        )}
      </View>
      {isSelected && (
        <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.accentStrong} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: 'transparent',
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
  },
  subtitle: {
    ...typography.subhead,
  },
});
