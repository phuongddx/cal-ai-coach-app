/**
 * WeeklyReviewCard.swift — the Ember hero card of the Coach tab (frame 12):
 * the "THIS WEEK" eyebrow, the weekly sentence, and the three stat tiles.
 * The stat row is the design-system WeeklyReviewStats (the ED-safe swap
 * lives there, GATE-1 — this feature file holds no policy branch), mounted
 * on a card inset inside the hero because the component has no onEmber
 * styling yet — the gap is recorded in findings U-75 under "Needs a design
 * component".
 */
import { StyleSheet, Text, View } from 'react-native';

import { EmberCard, radius, space, typography, useTokens, WeeklyReviewStats } from '../../../design';

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
        <View style={[styles.statsInset, { backgroundColor: colors.card }]}>
          <WeeklyReviewStats
            daysLogged={stats.daysLogged}
            daysOnTarget={stats.daysOnTarget}
            weeksAllLogged={stats.weeksAllLogged}
            kgThisWeek={stats.kgThisWeek}
          />
        </View>
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
  statsInset: {
    borderRadius: radius.md,
    padding: space.md,
  },
});
