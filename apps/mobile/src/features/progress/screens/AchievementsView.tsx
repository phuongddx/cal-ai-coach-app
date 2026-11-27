/**
 * AchievementsView.swift — ENG-01/02 achievements surface: the streak hero
 * (with freeze chip), the earned + locked badge grids, and the disabled
 * progress-photos row (ENG2-01 is v2 — the planner choice renders the row
 * disabled).
 */
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BadgeTile, SectionHeader, StreakCard, radius, useTokens } from '../../../design';

import type { Badge } from '../../../data/repos/engagementRepository';
import type { ProgressModel } from '../progressModel';

export type AchievementsViewProps = {
  model: ProgressModel;
};

/** AchievementsView.streakTitle — "Day 1 streak started!" from current == 1. */
export function streakTitle(current: number, best: number): string {
  return current <= 1 ? 'Day 1 streak started!' : `Personal best: ${best} days`;
}

/** AchievementsView.lockedDaysLeft — the locked tile's countdown, floored at 0. */
export function lockedDaysLeft(badge: Badge): number {
  return Math.max(badge.target - badge.progress, 0);
}

/** AchievementsView.emoji — the badge code's tile emoji. */
export function badgeEmoji(code: string): string {
  switch (code) {
    case 'first-scan':
      return '📸';
    case 'streak-7':
    case 'streak-30':
      return '🔥';
    case 'water-habit':
      return '💧';
    case 'scans-50':
      return '🎯';
    default:
      return '🏅';
  }
}

export function AchievementsView({ model }: AchievementsViewProps) {
  const { colors, space } = useTokens();
  const { streak, badges } = model.getSnapshot();

  const earned = badges.filter((badge) => badge.earnedAt !== null);
  const locked = badges.filter((badge) => badge.earnedAt === null);

  return (
    <View style={[styles.stack, { gap: space.md }]}>
      {streak !== null && (
        <StreakCard
          emoji="🔥"
          streak={streak.currentStreak}
          title={streakTitle(streak.currentStreak, streak.bestStreak)}
          freezesLeft={streak.freezesLeft}
        />
      )}

      {earned.length > 0 && (
        <>
          <SectionHeader title="Earned badges" />
          <BadgeGrid badges={earned} locked={false} />
        </>
      )}

      {locked.length > 0 && (
        <>
          <SectionHeader title="Unlock next" />
          <BadgeGrid badges={locked} locked />
        </>
      )}

      <ProgressPhotosRow />
    </View>
  );
}

/** 3-column grid that wraps regardless of how many badges are earned or locked. */
function BadgeGrid({ badges, locked }: { badges: Badge[]; locked: boolean }) {
  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <View key={badge.id} style={styles.gridCell}>
          <BadgeTile
            emoji={badgeEmoji(badge.code)}
            name={badge.label}
            detail={locked ? `${lockedDaysLeft(badge)} days left` : (badge.detail ?? '')}
            isLocked={locked}
          />
        </View>
      ))}
    </View>
  );
}

function ProgressPhotosRow() {
  const { colors, radius, space, typography } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel="Progress photos, coming later"
      style={[
        styles.photosRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
          gap: space.md,
        },
      ]}
    >
      <SymbolView name="camera" size={20} tintColor={colors.textSecondary} style={styles.cameraIcon} />
      <View style={styles.photosText}>
        <Text style={[typography.subhead, { color: colors.textPrimary }]}>Progress photos</Text>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>Coming later</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: { width: '31.5%', flexGrow: 1 },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    opacity: 0.5,
  },
  cameraIcon: { width: 24 },
  photosText: { gap: 2 },
});
