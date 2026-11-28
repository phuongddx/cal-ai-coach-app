/**
 * ProgressFlow.swift's view half — the Progress tab stack on Ember (frame
 * 11): the title, the range segment (Week / Month / 3M / Year, Month
 * selected) whose window the weight trend reads, the weekly energy bars
 * (which collapse entirely while the mode is on — the component owns that
 * policy, I7) and the badges.
 */
import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Segment, useTokens } from '../../../design';

import type { ProgressRange } from '../progressMath';
import type { ProgressModel } from '../progressModel';
import { AchievementsView } from './AchievementsView';
import { WeeklyEnergyView } from './WeeklyEnergyView';
import { WeightTrendView } from './WeightTrendView';

export type ProgressViewProps = {
  model: ProgressModel;
};

const RANGE_OPTIONS: ReadonlyArray<{ value: ProgressRange; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '3m', label: '3M' },
  { value: 'year', label: 'Year' },
];

export function ProgressView({ model }: ProgressViewProps) {
  const { colors, typography, space } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const [range, setRange] = useState<ProgressRange>('month');

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { gap: space.md }]}
    >
      <Text style={[typography.title, { color: colors.text }]}>Progress</Text>
      <Segment
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        variant="text"
        accessibilityLabel="Range"
        testID="progress.range"
      />
      <WeightTrendView model={model} range={range} />
      <WeeklyEnergyView model={model} />
      <AchievementsView model={model} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
});
