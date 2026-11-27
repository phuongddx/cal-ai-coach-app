/**
 * WeeklyReviewCard.swift — the weekly review: 3 stats + success
 * encouragement. The mode stat swap lives inside the DS component; this
 * feature file holds no policy branch (GATE-1).
 */
import { View } from 'react-native';

import { BannerNote, Card, SectionHeader, WeeklyReviewStats } from '../../../design';

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
  return (
    <Card>
      <View style={styles.stack}>
        <SectionHeader title="Weekly review" />

        <WeeklyReviewStats
          daysLogged={stats.daysLogged}
          daysOnTarget={stats.daysOnTarget}
          weeksAllLogged={stats.weeksAllLogged}
          kgThisWeek={stats.kgThisWeek}
        />

        <BannerNote text={encouragement(stats.daysLogged)} variant="success" />
      </View>
    </Card>
  );
}

const styles = {
  stack: { gap: 16 },
} as const;
