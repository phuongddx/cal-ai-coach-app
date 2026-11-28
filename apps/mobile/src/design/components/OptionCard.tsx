/**
 * CCOptionCard (Components/Controls.swift). Selectable option row with icon
 * tile (no tile when neither `icon` nor `iconName` is passed); the selected/unselected visual
 * state mapping is exposed for contract tests exactly as in Swift.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { radius, space, typography, useTokens, type Colors } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type OptionCardProps = {
  title: string;
  subtitle?: string;
  /** SF Symbol name of the earlier callers. Ignored when `iconName` is given. */
  icon?: string;
  /**
   * Ember canvas glyph for the 48 pt icon tile (`#i-*` of the canvas). When set, the tile draws this
   * `Icon` and the selected check is the canvas's filled orange check instead of the SF Symbol one.
   */
  iconName?: IconName;
  isSelected: boolean;
  onSelect?: () => void;
};

// Exposed for contract tests: the selected/unselected visual state mapping.
export function optionCardBorder(colors: Colors, isSelected: boolean): { width: number; color: string } {
  return isSelected ? { width: 2, color: colors.accentStrong } : { width: 1, color: colors.border };
}

/** Card fill: the frames tint the whole selected card (`accentTint`); unselected stays `card`. */
export function optionCardBackground(colors: Colors, isSelected: boolean): string {
  return isSelected ? colors.accentTint : colors.card;
}

/** Icon tile: orange `accent` disc on the tinted selected card (frames 21/22/24), `fill` otherwise. */
export function optionCardIconTile(colors: Colors, isSelected: boolean): string {
  return isSelected ? colors.accent : colors.fill;
}

/** Glyph ink: `onAccent` on the orange tile when selected, `text2` otherwise. */
export function optionCardIconColor(colors: Colors, isSelected: boolean): string {
  return isSelected ? colors.onAccent : colors.text2;
}

export function optionCardA11yLabel(title: string, subtitle: string | undefined, isSelected: boolean): string {
  return `${title}${subtitle != null ? `, ${subtitle}` : ''}, ${isSelected ? 'selected' : 'not selected'}`;
}

export function OptionCard({ title, subtitle, icon, iconName, isSelected, onSelect }: OptionCardProps) {
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
          backgroundColor: optionCardBackground(colors, isSelected),
          borderWidth: border.width,
          borderColor: border.color,
        },
      ]}
    >
      {(iconName != null || icon != null) && (
        <View
          testID={`option-card:${title}:tile`}
          style={[styles.iconTile, { backgroundColor: optionCardIconTile(colors, isSelected) }]}
        >
          {iconName != null ? (
            <Icon name={iconName} size={22} color={optionCardIconColor(colors, isSelected)} />
          ) : (
            <SymbolView name={icon as SFSymbol} size={20} tintColor={optionCardIconColor(colors, isSelected)} />
          )}
        </View>
      )}
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, { color: colors.text2 }]}>{subtitle}</Text>
        )}
      </View>
      {isSelected &&
        (iconName != null ? (
          <View
            testID={`option-card:${title}:check`}
            style={[styles.check, { backgroundColor: colors.accent }]}
          >
            <Icon name="check" size={14} color={colors.onAccent} />
          </View>
        ) : (
          <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.accentStrong} />
        ))}
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
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
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
