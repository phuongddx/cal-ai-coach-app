/**
 * CoachView.swift — the Coach tab on Ember (frame 12): the greeting subtitle
 * and title, the THIS WEEK hero card, the day's insights (seeded rows only)
 * on the design InsightCard with its Ember iconName and its action slot
 * (U-71d) — at most one action row, "See the days" opening the local list of
 * the days behind the insight; an insight the snapshot holds no days for
 * shows no row, and "Set a reminder" is not built — and the locked trust
 * copy rendered permanently, never conditional (T-P06-01).
 */
import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BannerNote,
  InsightCard,
  SectionHeader,
  space,
  typography,
  useTokens,
  type IconName,
} from '../../../design';

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

/** The insight tile's Ember glyph, per kind (frame 12's drop is hydration's). */
export function insightIconName(kind: string): IconName | undefined {
  switch (kind) {
    case 'streak':
      return 'flame';
    case 'hydration':
      return 'drop';
    case 'protein':
      return 'fork';
    default:
      return undefined;
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
  const { insights, insightDays, weekStats, targetKcal } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { gap: space.md }]}>
      <View style={styles.headerStack}>
        <Text style={[type.subhead, { color: colors.text2 }]}>{greetingText}</Text>
        <Text style={[type.title, { color: colors.text }]}>Coach</Text>
      </View>

      <WeeklyReviewCard stats={weekStats} targetKcal={targetKcal} />

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

/**
 * One insight card with at most one action row ("See the days"). The card is
 * the design InsightCard; the expanded day list stays under it here, because
 * the card owns no body slot.
 */
function CoachInsightCard({ insight, days }: { insight: Insight; days: string[] }) {
  const { colors, typography: type } = useTokens();
  const [showsDays, setShowsDays] = useState(false);

  return (
    <View style={styles.cardStack}>
      <InsightCard
        title={insight.title}
        text={insight.body}
        iconName={insightIconName(insight.kind)}
        variant={insightVariant(insight.kind)}
        action={
          days.length > 0
            ? {
                label: 'See the days',
                onPress: () => setShowsDays(!showsDays),
                testID: `coach.seeDays.${insight.kind}`,
              }
            : undefined
        }
      />
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  headerStack: { gap: 2 },
  insightStack: {},
  cardStack: { gap: space.xs },
  dayList: { gap: space.xs, paddingBottom: space.xs },
  dayRow: { fontVariant: ['tabular-nums'] },
});
