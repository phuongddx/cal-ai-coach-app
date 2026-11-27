/**
 * WeeklyEnergyView.swift — TRK-04 weekly energy: 7 day-labeled bars + avg
 * deficit footer. Status is never color-only — every bar carries a value
 * label and a day initial. The whole card is calorie (deficit) framing, so
 * the collapse component owns hiding it entirely while the mode is on
 * (invariant I7): this file holds no policy branch.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Card, EdSafeCollapse, SectionHeader, useTokens, withAlpha } from '../../../design';

import { dayInitial } from '../progressMath';
import type { DayKcal, ProgressModel } from '../progressModel';

export type WeeklyEnergyViewProps = {
  model: ProgressModel;
};

export const MAX_BAR_HEIGHT = 96;

/** WeeklyEnergyView.scaleKcal — the bar scale: the tallest day, or the target. */
export function scaleKcal(weekKcals: DayKcal[], targetKcal: number | null): number {
  const values = weekKcals.flatMap((entry) => (entry.kcal === null ? [] : [entry.kcal]));
  return Math.max(values.length > 0 ? Math.max(...values) : 0, targetKcal ?? 0, 1);
}

/** WeeklyEnergyView.footerText — the avg-deficit figure, "—" without data. */
export function footerText(targetKcal: number | null, weekKcals: DayKcal[]): string {
  const values = weekKcals.flatMap((entry) => (entry.kcal === null ? [] : [entry.kcal]));
  if (targetKcal === null || values.length === 0) {
    return '—';
  }
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const deficit = Math.round(targetKcal - average);
  if (deficit >= 0) {
    return `−${deficit} kcal/day`;
  }
  return `+${-deficit} kcal/day`;
}

export function WeeklyEnergyView({ model }: WeeklyEnergyViewProps) {
  const { colors, space } = useTokens();
  const weekKcals = model.weekKcals();
  const targetKcal = model.targetKcal();
  const scale = scaleKcal(weekKcals, targetKcal);

  return (
    <EdSafeCollapse>
      <Card>
        <View style={[styles.stack, { gap: space.md }]}>
          <SectionHeader title="Weekly energy" />

          <View style={[styles.barRow, { gap: space.sm }]}>
            {weekKcals.map((entry) => (
              <View key={entry.day} style={styles.barColumn}>
                <WeeklyEnergyColumn entry={entry} targetKcal={targetKcal} scale={scale} />
              </View>
            ))}
          </View>

          <View style={styles.footerRow}>
            <SectionHeader title="Avg deficit" />
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>{footerText(targetKcal, weekKcals)}</Text>
          </View>
        </View>
      </Card>
    </EdSafeCollapse>
  );
}

function WeeklyEnergyColumn({
  entry,
  targetKcal,
  scale,
}: {
  entry: DayKcal;
  targetKcal: number | null;
  scale: number;
}) {
  const { colors, typography } = useTokens();

  const valueText = entry.kcal === null ? '–' : `${entry.kcal}`;
  const barHeight =
    entry.kcal === null || !(scale > 0)
      ? 8
      : Math.max(MAX_BAR_HEIGHT * Math.min(entry.kcal / scale, 1), 8);
  const fillColor =
    entry.kcal === null
      ? 'rgba(255,255,255,0.1)'
      : targetKcal !== null && entry.kcal > targetKcal
        ? withAlpha(colors.warning, 0.8)
        : withAlpha(colors.success, 0.8);
  const label = entry.kcal === null ? `${dayInitial(entry.day)}: not logged` : `${dayInitial(entry.day)}: ${entry.kcal} kcal`;

  return (
    <View accessible accessibilityLabel={label} style={styles.column}>
      <Text style={[typography.footnote, styles.valueText, { color: colors.textSecondary }]}>{valueText}</Text>
      <View style={[styles.bar, { height: barHeight, backgroundColor: fillColor }]} />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{dayInitial(entry.day)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {},
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barColumn: { flex: 1 },
  column: { alignItems: 'center', gap: 4 },
  valueText: { fontVariant: ['tabular-nums'] },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 13, fontVariant: ['tabular-nums'], marginLeft: 'auto' },
});
