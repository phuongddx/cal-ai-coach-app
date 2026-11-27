/**
 * CoachView.swift — the Coach tab on Ember (frame 12): the greeting subtitle
 * and title, the THIS WEEK hero card, the day's insights (seeded rows only),
 * each with at most one action row — "See the days" opening the local list
 * of the days behind the insight; an insight the snapshot holds no days for
 * shows no row, and "Set a reminder" is not built — and the locked trust
 * copy rendered permanently, never conditional (T-P06-01). The insight card
 * is drawn here because the design-system InsightCard has no action slot —
 * the gap is recorded in findings U-75 under "Needs a design component";
 * the card keeps InsightCard's testID.
 */
import { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { BannerNote, SectionHeader, radius, space, typography, useTokens } from '../../../design';

import { dateFromDay } from '../../progress/progressMath';
import type { Insight } from '../../../data/repos/engagementRepository';
import type { CoachModel } from '../coachModel';
import { WeeklyReviewCard } from './WeeklyReviewCard';

export type CoachViewProps = {
  model: CoachModel;
  /** CoachFlow passes `CoachModel.greeting(for: environment.now(), …)` at mount. */
  greeting: string;
};

/** The Ember variant of an insight card: hydration is the info tint, the rest accent. */
export function insightVariant(kind: string): 'accent' | 'info' {
  return kind === 'hydration' ? 'info' : 'accent';
}

/** The insight tile's symbol, per kind (frame 12: sunrise/drop glyphs). */
export function insightSymbol(kind: string): string {
  switch (kind) {
    case 'streak':
      return 'flame';
    case 'hydration':
      return 'drop.fill';
    case 'protein':
      return 'fork.knife';
    default:
      return 'lightbulb';
  }
}

/** "Tue, Nov 24" — the day row of the expanded day list. */
export function insightDayLabel(day: string): string {
  const date = dateFromDay(day);
  if (date === null) {
    return day;
  }
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function CoachView({ model, greeting: greetingText }: CoachViewProps) {
  const { colors, space, typography: type } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const { insights, insightDays } = model.getSnapshot();

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { gap: space.md }]}>
      <View style={styles.headerStack}>
        <Text style={[type.subhead, { color: colors.text2 }]}>{greetingText}</Text>
        <Text style={[type.title, { color: colors.text }]}>Coach</Text>
      </View>

      <WeeklyReviewCard stats={model.getSnapshot().weekStats} targetKcal={model.getSnapshot().targetKcal} />

      {insights.length > 0 && (
        <>
          <SectionHeader title="Insights" />
          <View style={[styles.insightStack, { gap: space.md }]}>
            {insights.map((insight) => (
              <CoachInsightCard key={insight.id} insight={insight} days={insightDays[insight.id] ?? []} />
            ))}
          </View>
        </>
      )}

      {/* Locked trust copy (T-P06-01) — rendered permanently, never conditional. */}
      <BannerNote
        text='Coach provides supportive guidance based on your data. Not medical advice. No food is "good" or "bad."'
      />
    </ScrollView>
  );
}

/** One insight card with at most one action row ("See the days"). */
function CoachInsightCard({ insight, days }: { insight: Insight; days: string[] }) {
  const { colors, typography: type } = useTokens();
  const [showsDays, setShowsDays] = useState(false);
  const variant = insightVariant(insight.kind);
  const isInfo = variant === 'info';
  const barColor = isInfo ? colors.info : colors.accentStrong;
  const tileBackground = isInfo ? colors.infoTint : colors.accentTint;
  const iconColor = isInfo ? colors.infoInk : colors.accentInk;

  return (
    <View
      testID={`insight-card:${variant}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.cardBar, { backgroundColor: barColor }]} />
      <View style={[styles.iconTile, { backgroundColor: tileBackground }]}>
        <SymbolView name={insightSymbol(insight.kind) as SFSymbol} size={17} tintColor={iconColor} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[type.headline, { color: colors.text }]}>{insight.title}</Text>
        <Text style={[type.subhead, { color: colors.text2 }]}>{insight.body}</Text>
        {days.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See the days"
            testID={`coach.seeDays.${insight.kind}`}
            onPress={() => setShowsDays(!showsDays)}
            style={styles.actionRow}
          >
            <Text style={[type.subhead, styles.actionText, { color: colors.accentInk }]}>See the days</Text>
            <SymbolView name={'chevron.right' as SFSymbol} size={12} tintColor={colors.accentInk} />
          </Pressable>
        )}
        {showsDays && days.length > 0 && (
          <View testID="coach.dayList" style={styles.dayList}>
            {days.map((day) => (
              <Text key={day} style={[type.footnote, styles.dayRow, { color: colors.text2 }]}>
                {insightDayLabel(day)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  headerStack: { gap: 2 },
  insightStack: {},
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    overflow: 'hidden',
  },
  cardBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: space.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  actionText: { fontWeight: '600' },
  dayList: { gap: space.xs, paddingBottom: space.xs },
  dayRow: { fontVariant: ['tabular-nums'] },
});
