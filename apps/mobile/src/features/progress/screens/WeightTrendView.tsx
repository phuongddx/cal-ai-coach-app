/**
 * WeightTrendView.swift — the Ember weight trend card (frame 11): the
 * "Weight trend" label with the big current value, the direction row over the
 * selected range window, the Ember chart with its fitted axis, and the
 * "Log weight" tint chip presenting WeightLogSheet. ED-safe keeps the card
 * (kg framing is not calorie framing) exactly as the Swift ED-safe snapshot.
 */
import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Card, TrendChart, radius, space, typography, useTokens } from '../../../design';

import { RANGE_WINDOW_DAYS, type ProgressRange } from '../progressMath';
import { weightPointsOf, type ProgressModel } from '../progressModel';
import { weightTrendA11yLabel } from '../weightChartDescriptor';
import { WeightLogSheet } from './WeightLogSheet';

export type WeightTrendViewProps = {
  model: ProgressModel;
  /** The selected range window; Month is the segment's default. */
  range?: ProgressRange;
};

/** WeightTrendView.trendCopy — direction icon + window text; non-color-only. */
export function trendCopy(kgLost: number, windowDays: number): { symbol: 'arrow.down' | 'arrow.up' | 'arrow.right'; text: string } {
  if (kgLost > 0.05) {
    return { symbol: 'arrow.down', text: `−${kgLost.toFixed(1)} kg in ${windowDays} days` };
  }
  if (kgLost < -0.05) {
    return { symbol: 'arrow.up', text: `+${(-kgLost).toFixed(1)} kg in ${windowDays} days` };
  }
  return { symbol: 'arrow.right', text: 'holding steady' };
}

export function WeightTrendView({ model, range = 'month' }: WeightTrendViewProps) {
  const { colors, typography: type } = useTokens();
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const [isLogSheetPresented, setIsLogSheetPresented] = useState(false);

  const windowDays = RANGE_WINDOW_DAYS[range];
  const points = weightPointsOf(snapshot.weights, snapshot.today, range);
  const startKg = points[0]?.value ?? null;
  const latestKg = snapshot.weights.at(-1)?.kg ?? null;
  const kgLost = startKg !== null && latestKg !== null ? startKg - latestKg : 0;
  const copy = trendCopy(kgLost, windowDays);
  const currentWeightText = latestKg !== null ? latestKg.toFixed(1) : '—';

  return (
    <Card>
      <View style={styles.stack}>
        <View style={styles.headerRow}>
          <View style={styles.headerColumn}>
            <Text style={[type.footnote, { color: colors.text2 }]}>Weight trend</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.weightValue, { color: colors.text }]}>{currentWeightText}</Text>
              <Text style={[typography.subhead, styles.unitText, { color: colors.text2 }]}>kg</Text>
            </View>
            <View accessible accessibilityLabel={copy.text} style={styles.progressRow}>
              <SymbolView
                name={copy.symbol}
                size={14}
                weight="semibold"
                tintColor={kgLost > 0.05 ? colors.successInk : colors.textSecondary}
              />
              <Text
                style={[
                  typography.footnote,
                  styles.progressText,
                  { color: kgLost > 0.05 ? colors.successInk : colors.textSecondary },
                ]}
              >
                {copy.text}
              </Text>
            </View>
          </View>
          <View style={styles.spacer} />
          <View testID="progress.logWeight">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log weight"
              onPress={() => setIsLogSheetPresented(true)}
              style={[styles.logChip, { backgroundColor: colors.accentTint }]}
            >
              <Text style={[typography.subhead, styles.logChipText, { color: colors.accentInk }]}>Log weight</Text>
            </Pressable>
          </View>
        </View>

        {points.length >= 2 ? (
          <TrendChart
            points={points.map((point) => ({ at: point.date, value: point.value }))}
            unit="kg"
            accessibilityLabel={weightTrendA11yLabel(points, windowDays)}
            testID="chart-card"
          />
        ) : (
          <Text style={[styles.emptyTrend, type.subhead, { color: colors.textSecondary }]}>
            Log your weight to start the trend
          </Text>
        )}
      </View>

      <Modal
        visible={isLogSheetPresented}
        animationType="slide"
        transparent
        onRequestClose={() => setIsLogSheetPresented(false)}
      >
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.background }]}>
          <WeightLogSheet
            currentKg={latestKg}
            onSave={(kg) => {
              // Best effort, as the Swift `try?`: a failed local save keeps the sheet state.
              void model.logWeight(kg).catch(() => undefined);
            }}
            onDismiss={() => setIsLogSheetPresented(false)}
          />
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerColumn: { alignItems: 'flex-start', gap: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  weightValue: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unitText: { fontWeight: '600' },
  spacer: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  logChip: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  logChipText: { fontWeight: '700' },
  emptyTrend: { textAlign: 'center', paddingVertical: 20 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
