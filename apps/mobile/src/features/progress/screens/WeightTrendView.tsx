/**
 * WeightTrendView.swift — the weight trend card: Current/Goal headers, the
 * chart (from two points) with its chart-descriptor a11y data, the trend
 * direction row, and the Log weight button presenting WeightLogSheet. ED-safe
 * keeps the card (kg framing is not calorie framing) exactly as the Swift
 * ED-safe snapshot.
 */
import { useState, useSyncExternalStore } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Card, ChartCard, SectionHeader, PrimaryButton, space, useTokens } from '../../../design';

import type { ProgressModel } from '../progressModel';
import { WeightLogSheet } from './WeightLogSheet';

export type WeightTrendViewProps = {
  model: ProgressModel;
};

/** WeightTrendView.trendCopy — direction icon + text; keeps status non-color-only. */
export function trendCopy(kgLost: number): { symbol: 'arrow.down' | 'arrow.up' | 'arrow.right'; text: string } {
  if (kgLost > 0.05) {
    return { symbol: 'arrow.down', text: `${kgLost.toFixed(1)} kg lost · on track` };
  }
  if (kgLost < -0.05) {
    return { symbol: 'arrow.up', text: `${(-kgLost).toFixed(1)} kg gained` };
  }
  return { symbol: 'arrow.right', text: 'holding steady' };
}

export function WeightTrendView({ model }: WeightTrendViewProps) {
  const { colors, typography } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const [isLogSheetPresented, setIsLogSheetPresented] = useState(false);

  const points = model.weightPoints();
  const startKg = model.startKg();
  const latestKg = model.latestKg();
  const kgLost = startKg !== null && latestKg !== null ? startKg - latestKg : 0;
  const copy = trendCopy(kgLost);
  const currentWeightText = latestKg !== null ? `${latestKg.toFixed(1)} kg` : '—';
  const goalWeightText = model.goalKg() !== null ? `${(model.goalKg() as number).toFixed(1)} kg` : '—';

  return (
    <Card>
      <View style={styles.stack}>
        <View style={styles.headerRow}>
          <View style={styles.headerColumn}>
            <SectionHeader title="Current" />
            <Text style={[styles.weightValue, { color: colors.textPrimary }]}>{currentWeightText}</Text>
          </View>
          <View style={styles.spacer} />
          <View style={styles.headerColumnTrailing}>
            <SectionHeader title="Goal" />
            <Text style={[styles.weightValue, { color: colors.accentInk }]}>{goalWeightText}</Text>
          </View>
        </View>

        {points.length >= 2 ? (
          <ChartCard points={points} />
        ) : (
          <Text style={[styles.emptyTrend, typography.subhead, { color: colors.textSecondary }]}>
            Log your weight to start the trend
          </Text>
        )}

        <View accessible accessibilityLabel={copy.text} style={styles.progressRow}>
          <SymbolView
            name={copy.symbol}
            size={14}
            weight="semibold"
            tintColor={kgLost > 0.05 ? colors.successInk : colors.textSecondary}
          />
          <Text
            style={[
              typography.subhead,
              styles.progressText,
              { color: kgLost > 0.05 ? colors.successInk : colors.textSecondary },
            ]}
          >
            {copy.text}
          </Text>
        </View>

        <View testID="progress.logWeight">
          <PrimaryButton title="Log weight" action={() => setIsLogSheetPresented(true)} />
        </View>
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
  headerColumnTrailing: { alignItems: 'flex-end', gap: 2 },
  spacer: { flex: 1 },
  weightValue: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyTrend: { textAlign: 'center', paddingVertical: 20 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressText: { fontWeight: '500', fontVariant: ['tabular-nums'] },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
