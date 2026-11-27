/**
 * CCBadgeTile (Components/Cards.swift). Emoji + name + detail tile; locked
 * badges dim to 0.5 and grayscale.
 */

import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type BadgeTileProps = {
  /** Emoji of the earlier callers. Ignored when `iconName` is given. */
  emoji?: string;
  /** Ember canvas glyph (`#i-*`) drawn instead of the emoji, in the accent ink (text2 when locked). */
  iconName?: IconName;
  name: string;
  detail: string;
  isLocked?: boolean;
};

export function badgeA11yLabel(name: string, isLocked: boolean, detail: string): string {
  return `${name}, ${isLocked ? 'locked' : 'earned'}${isLocked ? `, ${detail}` : ''}`;
}

export function BadgeTile({ emoji, iconName, name, detail, isLocked = false }: BadgeTileProps) {
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
      {iconName != null ? (
        <View style={styles.iconBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name={iconName} size={32} color={isLocked ? colors.text2 : colors.accentInk} />
        </View>
      ) : (
        <Text style={styles.emoji} accessibilityElementsHidden>
          {emoji}
        </Text>
      )}
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
  iconBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
