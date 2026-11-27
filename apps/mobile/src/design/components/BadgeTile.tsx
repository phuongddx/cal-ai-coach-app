/**
 * CCBadgeTile (Components/Cards.swift). Emoji + name + detail tile; locked
 * badges dim to 0.5 and grayscale.
 */

import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

export type BadgeTileProps = {
  emoji: string;
  name: string;
  detail: string;
  isLocked?: boolean;
};

export function badgeA11yLabel(name: string, isLocked: boolean, detail: string): string {
  return `${name}, ${isLocked ? 'locked' : 'earned'}${isLocked ? `, ${detail}` : ''}`;
}

export function BadgeTile({ emoji, name, detail, isLocked = false }: BadgeTileProps) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={badgeA11yLabel(name, isLocked, detail)}
      testID={`badge-tile:${name}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isLocked ? 0.5 : 1,
          filter: isLocked ? [{ grayscale: 1 }] : undefined,
        },
      ]}
    >
      <Text style={styles.emoji} accessibilityElementsHidden>
        {emoji}
      </Text>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.detail, { color: colors.text2 }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  emoji: {
    fontSize: 32,
  },
  name: {
    ...typography.subhead,
    fontWeight: '500',
  },
  detail: {
    ...typography.caption,
    textAlign: 'center',
  },
});
