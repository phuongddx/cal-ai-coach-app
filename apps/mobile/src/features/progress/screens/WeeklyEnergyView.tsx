/**
 * WeeklyEnergyView.swift — TRK-04 weekly energy on Ember (frame 11): the
 * "avg N kcal" header figure, seven day-labeled bars in `accentStrong` with
 * the value labels (status is never color-only), today's bar dashed with the
 * accent-ink day initial, and the dashed average line. The whole card is
 * calorie (energy) framing, so the collapse component owns hiding it entirely
 * while the mode is on (invariant I7): this file holds no policy branch.
 */
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Card, EdSafeCollapse, SectionHeader, typography, useTokens, withAlpha } from '../../../design';

import { dayInitial } from '../progressMath';
import type { DayKcal, ProgressModel } from '../progressModel';

export type WeeklyEnergyViewProps = {
  model: ProgressModel;
};

export const MAX_BAR_HEIGHT = 96;
/** Fixed height of the value label above each bar, so the average line and the bars share one band. */
const VALUE_LABEL_HEIGHT = 18;

/** WeeklyEnergyView.scaleKcal — the bar scale: the tallest day, or the target. */
export function scaleKcal(weekKcals: DayKcal[], targetKcal: number | null): number {
  const values = weekKcals.flatMap((entry) => (entry.kcal === null ? [] : [entry.kcal]));
  return Math.max(values.length > 0 ? Math.max(...values) : 0, targetKcal ?? 0, 1);
}

/** The frame's header figure: "avg 1,980 kcal", "—" without logged days. */
export function averageKcalText(weekKcals: DayKcal[]): string {
  const values = weekKcals.flatMap((entry) => (entry.kcal === null ? [] : [entry.kcal]));
  if (values.length === 0) {
    return '—';
  }
  const average = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  return `avg ${new Intl.NumberFormat('en-US').format(average)} kcal`;
}

export function WeeklyEnergyView({ model }: WeeklyEnergyViewProps) {
  const { colors, space } = useTokens();
  const [width, setWidth] = useState(0);
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const weekKcals = snapshot.weekKcals;
  const targetKcal = snapshot.target?.dailyKcal ?? null;
  const scale = scaleKcal(weekKcals, targetKcal);
  const loggedValues = weekKcals.flatMap((entry) => (entry.kcal === null ? [] : [entry.kcal]));
  const average =
    loggedValues.length > 0
      ? loggedValues.reduce((total, value) => total + value, 0) / loggedValues.length
      : null;
  const averageY =
    average === null ? null : MAX_BAR_HEIGHT - Math.max(Math.min(average / scale, 1), 0) * MAX_BAR_HEIGHT;

  return (
    <EdSafeCollapse>
      <Card>
        <View style={[styles.stack, { gap: space.md }]}>
          <View style={styles.headerRow}>
            <SectionHeader title="Weekly energy" />
            <Text style={[typography.subhead, styles.averageText, { color: colors.text }]}>
              {averageKcalText(weekKcals)}
            </Text>
          </View>

          <View style={[styles.chartArea, { gap: space.sm }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            {averageY !== null && width > 0 && (
              <Svg
                style={[styles.averageLine, { top: VALUE_LABEL_HEIGHT }]}
                width={width}
                height={MAX_BAR_HEIGHT}
                pointerEvents="none"
              >
                <Line
                  x1={0}
                  y1={averageY}
                  x2={width}
                  y2={averageY}
                  stroke={colors.text2}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              </Svg>
            )}
            <View style={[styles.barRow, { gap: space.sm }]}>
              {weekKcals.map((entry, index) => (
                <View key={entry.day} style={styles.barColumn}>
                  <WeeklyEnergyColumn
                    entry={entry}
                    scale={scale}
                    isToday={index === weekKcals.length - 1}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </Card>
    </EdSafeCollapse>
  );
}

function WeeklyEnergyColumn({
  entry,
  scale,
  isToday,
}: {
  entry: DayKcal;
  scale: number;
  isToday: boolean;
}) {
  const { colors, typography: type } = useTokens();

  const valueText = entry.kcal === null ? '–' : `${entry.kcal}`;
  const barHeight =
    entry.kcal === null || !(scale > 0)
      ? 8
      : Math.max(MAX_BAR_HEIGHT * Math.min(entry.kcal / scale, 1), 8);
  const label = entry.kcal === null ? `${dayInitial(entry.day)}: not logged` : `${dayInitial(entry.day)}: ${entry.kcal} kcal`;

  return (
    <View accessible accessibilityLabel={label} style={styles.column}>
      <Text style={[type.footnote, styles.valueText, { color: colors.textSecondary, height: VALUE_LABEL_HEIGHT }]}>
        {valueText}
      </Text>
      <View style={styles.barArea}>
        <View
          style={[
            styles.bar,
            isToday
              ? {
                  height: barHeight,
                  backgroundColor: colors.fill,
                  borderWidth: 1.5,
                  borderColor: colors.text3,
                  borderStyle: 'dashed',
                }
              : { height: barHeight, backgroundColor: entry.kcal === null ? withAlpha(colors.text, 0.1) : colors.accentStrong },
          ]}
        />
      </View>
      <Text
        style={[type.caption, { color: isToday ? colors.accentInk : colors.textSecondary }]}
      >
        {dayInitial(entry.day)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {},
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  averageText: { marginLeft: 'auto', fontWeight: '600', fontVariant: ['tabular-nums'] },
  chartArea: {},
  averageLine: { position: 'absolute', left: 0 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barColumn: { flex: 1 },
  column: { alignItems: 'center', gap: 4 },
  valueText: { fontVariant: ['tabular-nums'] },
  barArea: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  bar: { width: '100%', borderRadius: 6 },
});
