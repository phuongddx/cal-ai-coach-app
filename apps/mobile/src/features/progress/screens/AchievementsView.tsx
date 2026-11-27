/**
 * AchievementsView.swift — ENG-01/02 achievements surface on Ember (frame
 * 11): the streak hero (with freeze chip), one "Badges" grid — earned tiles
 * first, then locked, Swift order — with the Ember icon set on the design
 * BadgeTile (`iconName`, U-71d) in place of emoji, and the disabled
 * progress-photos row (ENG2-01 is v2 — the planner choice renders the row
 * disabled). The tile keeps BadgeTile's testID and accessibility label.
 */
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  BadgeTile,
  SectionHeader,
  StreakCard,
  radius,
  space,
  useTokens,
  type IconName,
} from '../../../design';

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

/** The Ember icon of a badge tile (frame 11: camera, flame; locked: lock). */
export function badgeIcon(code: string, isLocked: boolean): IconName {
  if (isLocked) {
    return 'lock';
  }
  switch (code) {
    case 'first-scan':
      return 'camera';
    case 'streak-7':
    case 'streak-30':
      return 'flame';
    case 'water-habit':
      return 'drop';
    case 'scans-50':
      return 'target';
    default:
      return 'trophy';
  }
}

export function AchievementsView({ model }: AchievementsViewProps) {
  const { space } = useTokens();
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

      {badges.length > 0 && (
        <>
          <SectionHeader title="Badges" />
          <BadgeGrid badges={[...earned, ...locked]} lockedCount={locked.length} />
        </>
      )}

      <ProgressPhotosRow />
    </View>
  );
}

/** 3-column grid that wraps regardless of how many badges are earned or locked. */
function BadgeGrid({ badges, lockedCount }: { badges: Badge[]; lockedCount: number }) {
  return (
    <View style={styles.grid}>
      {badges.map((badge, index) => {
        const isLocked = index >= badges.length - lockedCount;
        return (
          <View key={badge.id} style={styles.gridCell}>
            <BadgeTile
              iconName={badgeIcon(badge.code, isLocked)}
              name={badge.label}
              detail={isLocked ? `${lockedDaysLeft(badge)} days left` : (badge.detail ?? '')}
              isLocked={isLocked}
            />
          </View>
        );
      })}
    </View>
  );
}

function ProgressPhotosRow() {
  const { colors, radius, space, typography: type } = useTokens();
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
        <Text style={[type.subhead, { color: colors.text }]}>Progress photos</Text>
        <Text style={[type.caption, { color: colors.textTertiary }]}>Coming later</Text>
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
