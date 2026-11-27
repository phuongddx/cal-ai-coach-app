/**
 * CCStreakCard (Components/Cards.swift). Emoji, hero streak number, title and
 * a freeze chip on a lime gradient. RN has no expo-linear-gradient in this
 * worktree; the gradient is a react-native-svg LinearGradient exactly like the
 * Swift one (10% lime at top, 5% at bottom).
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';

import { radius, space, typography, useTokens } from '../tokens';

import { ScaledNumber } from './ScaledNumber';

export type StreakCardProps = {
  emoji: string;
  streak: number;
  title: string;
  freezesLeft: number;
};

export function streakA11yLabel(streak: number, freezesLeft: number): string {
  return `${streak} day streak, ${freezesLeft} freeze${freezesLeft === 1 ? '' : 's'} left`;
}

export function streakChipText(freezesLeft: number): string {
  return freezesLeft === 1 ? '1 freeze left' : `${freezesLeft} freezes left`;
}

export function StreakCard({ emoji, streak, title, freezesLeft }: StreakCardProps) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={streakA11yLabel(streak, freezesLeft)}
      testID="streak-card"
      style={[styles.card, { borderColor: colors.accentStrong }]}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgGradient id="cc-streak-gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accentTint} />
            <Stop offset="1" stopColor={colors.card} />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius.lg} fill="url(#cc-streak-gradient)" />
      </Svg>
      <Text style={styles.emoji} accessibilityElementsHidden>
        {emoji}
      </Text>
      <ScaledNumber text={`${streak}`} role="hero" style={{ color: colors.accentInk }} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text
        style={[
          styles.chip,
          { color: colors.accentInk, backgroundColor: colors.accentTint },
        ]}
      >
        {streakChipText(freezesLeft)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.xl,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    ...typography.heading,
  },
  chip: {
    ...typography.caption,
    marginTop: space.xs,
    overflow: 'hidden',
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: 999,
  },
});
