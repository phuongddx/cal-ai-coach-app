/**
 * ProgressFlow.swift's view half — the Progress tab stack: the title, the
 * weight trend, the weekly energy bars (which collapse entirely while the
 * mode is on — the component owns that policy, I7) and the achievements.
 */
import { useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../../design';

import type { ProgressModel } from '../progressModel';
import { AchievementsView } from './AchievementsView';
import { WeeklyEnergyView } from './WeeklyEnergyView';
import { WeightTrendView } from './WeightTrendView';

export type ProgressViewProps = {
  model: ProgressModel;
};

export function ProgressView({ model }: ProgressViewProps) {
  const { colors, typography } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>Progress</Text>
      <WeightTrendView model={model} />
      <WeeklyEnergyView model={model} />
      <AchievementsView model={model} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
});
