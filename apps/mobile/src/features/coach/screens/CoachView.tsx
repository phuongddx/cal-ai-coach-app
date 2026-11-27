/**
 * CoachView.swift — the Coach tab: the greeting, the day's insights (seeded
 * rows only), the weekly review card, and the locked trust copy rendered
 * permanently, never conditional (T-P06-01).
 */
import { useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BannerNote, InsightCard, SectionHeader, useTokens } from '../../../design';

import type { CoachModel } from '../coachModel';
import { WeeklyReviewCard } from './WeeklyReviewCard';

export type CoachViewProps = {
  model: CoachModel;
  /** CoachFlow passes `CoachModel.greeting(for: environment.now(), …)` at mount. */
  greeting: string;
};

export function CoachView({ model, greeting: greetingText }: CoachViewProps) {
  const { colors, space, typography } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const { insights, weekStats } = model.getSnapshot();

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{greetingText}</Text>

      {insights.length > 0 && (
        <>
          <SectionHeader title="Today's insights" />
          <View style={[styles.insightStack, { gap: space.md }]}>
            {insights.map((insight) => (
              <InsightCard key={insight.id} title={insight.title} text={insight.body} />
            ))}
          </View>
        </>
      )}

      <WeeklyReviewCard stats={weekStats} targetKcal={model.getSnapshot().targetKcal} />

      {/* Locked trust copy (T-P06-01) — rendered permanently, never conditional. */}
      <BannerNote
        text='Coach provides supportive guidance based on your data. Not medical advice. No food is "good" or "bad."'
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
  insightStack: {},
});
