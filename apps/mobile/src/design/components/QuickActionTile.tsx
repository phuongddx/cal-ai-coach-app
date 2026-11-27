/**
 * CCQuickActionTile (Components/Controls.swift). Icon-over-label tile, accent
 * tinted when highlighted. The glyph is an Ember icon (`iconName`, the canvas `#i-*` set) or, for the
 * earlier callers, an SF Symbol (`icon`); `iconName` wins when both are given, as in `OptionCard`.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type QuickActionTileProps = {
  title: string;
  /** SF Symbol name of the earlier callers. Ignored when `iconName` is given. */
  icon?: string;
  /** Ember canvas glyph (`#i-*`), drawn at 28 pt. */
  iconName?: IconName;
  isHighlighted?: boolean;
  action?: () => void;
};

export function QuickActionTile({
  title,
  icon,
  iconName,
  isHighlighted = false,
  action,
}: QuickActionTileProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={`quick-action:${title}`}
      onPress={action}
      style={[
        styles.tile,
        {
          backgroundColor: isHighlighted
            ? colors.accentTint
            : colors.card,
          borderColor: isHighlighted
            ? colors.accentStrong
            : colors.border,
        },
      ]}
    >
      {iconName != null ? (
        <Icon name={iconName} size={28} color={isHighlighted ? colors.accentInk : colors.text} />
      ) : (
        icon != null && (
          <SymbolView
            name={icon as SFSymbol}
            size={28}
            tintColor={isHighlighted ? colors.accentInk : colors.text}
          />
        )
      )}
      <Text
        style={[
          styles.title,
          { color: isHighlighted ? colors.accentInk : colors.text2 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    paddingVertical: space.xl2,
  },
  title: {
    ...typography.caption,
    fontWeight: '500',
  },
});
