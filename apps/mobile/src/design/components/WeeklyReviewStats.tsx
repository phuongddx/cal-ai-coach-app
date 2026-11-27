/**
 * CCWeeklyReviewStats (Components/WeeklyStats.swift). Group E weekly review
 * stat row (accent value + caption). Under ED-safe the kcal-derived
 * "% on target" and kg framing swap for "weeks with all meals logged"
 * (TRU-04 weekly-average rule) — the branch lives here, in the design system,
 * never in feature files.
 */

import { StyleSheet, Text, View } from 'react-native';

import { space, typography, useTokens } from '../tokens';

import { useEdSafeMode } from '../edSafe';

export type WeeklyStat = {
  id: string;
  label: string;
  value: string;
};

export type WeeklyReviewStatsProps = {
  daysLogged: number;
  daysOnTarget: number;
  weeksAllLogged: number;
  kgThisWeek: number;
};

/** The pure stat-visibility core so both ED-safe branches are assertable
 * without environment injection (as in Swift). */
export function visibleStats(
  daysLogged: number,
  daysOnTarget: number,
  weeksAllLogged: number,
  kgThisWeek: number,
  edSafeMode: boolean,
): WeeklyStat[] {
  const visible: WeeklyStat[] = [
    { id: 'days', label: 'Days logged', value: `${daysLogged}` },
  ];
  if (edSafeMode) {
    visible.push({
      id: 'weeks',
      label: 'Weeks with all meals logged',
      value: `${weeksAllLogged}`,
    });
  } else {
    const percent =
      daysLogged > 0 ? Math.round((daysOnTarget / daysLogged) * 100) : 0;
    visible.push({ id: 'target', label: '% on target', value: `${percent}%` });
    visible.push({ id: 'kg', label: 'kg this week', value: kgValue(kgThisWeek) });
  }
  return visible;
}

/** Rounded to one decimal, signed with + / − (U+2212), "0.0" at zero.
 * Rounding is away from zero to match Swift's `.rounded()`. */
export function kgValue(kg: number): string {
  const magnitude = Math.round(Math.abs(kg) * 10) / 10;
  const rounded = kg < 0 ? -magnitude : magnitude;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  if (rounded < 0) return `−${(-rounded).toFixed(1)}`;
  return '0.0';
}

export function WeeklyReviewStats({
  daysLogged,
  daysOnTarget,
  weeksAllLogged,
  kgThisWeek,
}: WeeklyReviewStatsProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  const stats = visibleStats(daysLogged, daysOnTarget, weeksAllLogged, kgThisWeek, edSafeMode);
  return (
    <View
      testID="weekly-review-stats"
      style={styles.row}
      accessible={false}
    >
      {stats.map((stat) => (
        <View key={stat.id} style={styles.stat} accessible>
          <Text style={[styles.value, { color: colors.accentInk }]}>{stat.value}</Text>
          <Text
            style={[styles.label, { color: colors.textSecondary }]}
            testID={`weekly-stat:${stat.id}`}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
  },
  stat: {
    flexGrow: 1,
    gap: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...typography.caption,
  },
});
