/**
 * WeeklyReviewCard.swift — the Ember hero card of the Coach tab (frame 12):
 * the "THIS WEEK" eyebrow, the weekly sentence, and the three stat tiles.
 * The stat row is the design-system WeeklyReviewStats mounted with `onEmber`
 * (U-71d): the ED-safe swap still lives in the design system (GATE-1 — this
 * feature file holds no policy branch), and the tiles read directly on the
 * ember card as the frame draws them.
 */
import { StyleSheet, Text, View } from 'react-native';

import { EmberCard, space, typography, useTokens, WeeklyReviewStats } from '../../../design';

import type { WeekStats } from '../coachSnapshot';

export type WeeklyReviewCardProps = {
  stats: WeekStats;
  targetKcal: number | null;
};

/** WeeklyReviewCard.encouragement — habit framing only, no kcal, no food morality. */
export function encouragement(daysLogged: number): string {
  return daysLogged >= 7
    ? 'You logged every day this week — great consistency!'
    : `You logged ${daysLogged} of 7 days this week — keep it up!`;
}

export function WeeklyReviewCard({ stats }: WeeklyReviewCardProps) {
  const { colors } = useTokens();
  return (
    <EmberCard>
      <View style={styles.stack}>
        <Text style={[typography.footnote, styles.eyebrow, { color: colors.emberAccent }]}>THIS WEEK</Text>
        <Text style={[styles.sentence, { color: colors.emberText }]}>{encouragement(stats.daysLogged)}</Text>
        <WeeklyReviewStats
          onEmber
          daysLogged={stats.daysLogged}
          daysOnTarget={stats.daysOnTarget}
          weeksAllLogged={stats.weeksAllLogged}
          kgThisWeek={stats.kgThisWeek}
        />
      </View>
    </EmberCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  eyebrow: {
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  sentence: {
    fontSize: 22,
    fontWeight: '700',
  },
});
