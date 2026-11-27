/**
 * CCQuickActionTile (Components/Controls.swift). Icon-over-label tile, lime
 * tinted when highlighted.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens, withAlpha } from '../tokens';

export type QuickActionTileProps = {
  title: string;
  icon: string;
  isHighlighted?: boolean;
  action?: () => void;
};

export function QuickActionTile({
  title,
  icon,
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
            ? withAlpha(colors.accentLime, 0.1)
            : colors.card,
          borderColor: isHighlighted
            ? withAlpha(colors.accentLime, 0.3)
            : colors.border,
        },
      ]}
    >
      <SymbolView
        name={icon}
        size={28}
        tintColor={isHighlighted ? colors.accentInk : colors.textPrimary}
      />
      <Text
        style={[
          styles.title,
          { color: isHighlighted ? colors.accentInk : colors.textSecondary },
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
