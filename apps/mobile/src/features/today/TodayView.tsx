/**
 * TodayView.swift — the Today screen, built from the design system on the tokens. The ED-safe
 * policy is owned by the components (invariant I7): the ring, the food rows and the collapse
 * wrapper read the mode themselves; nothing in this file branches on it.
 *
 * Identifiers: each Swift `accessibilityIdentifier` is the `testID` of the same element.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BannerNote,
  CalorieRing,
  ConfidenceBadge,
  EdSafeCollapse,
  FoodRow,
  MacroBar,
  MacroMiniCard,
  OfflineBadge,
  PrimaryButton,
  SectionHeader,
  StreakCard,
  radius,
  size,
  space,
  typography,
  useTokens,
  withAlpha,
} from '../../design';
import { WaterCard, WaterLogSheet } from '../diary/screens/WaterCard';

import { FAB_BOTTOM_PADDING } from './ScanFab';
import { goalSubheadText, headerDateText, mealMeta } from './todayFormat';
import {
  consumedKcal,
  consumedMacro,
  dayProgress,
  goalKcal,
  goalMacro,
  stepsDisplayValue,
  waterGlasses,
  weekStripDays,
  type TodayModel,
  type TodaySnapshot,
} from './todayModel';
import { useTodaySnapshot } from './useTodayModel';
import { WeekStripView } from './WeekStripView';

export type TodayViewProps = {
  model: TodayModel;
  isOffline?: boolean;
  onStartSetup?: () => void;
  /** A meal row (or the "Open diary" link) opens the diary day sheet for this day. */
  onOpenDiary?: (day: Date) => void;
  /** The Steps card when HealthKit access was denied (Swift opens the Settings app). */
  onOpenHealthSettings?: () => void;
};

/** CCSpace.xl5: the gap the Swift list keeps between the last row and the Scan button. */
export const TODAY_BOTTOM_INSET = 48;

/**
 * Bottom padding of the list. SwiftUI's TabView insets the list for the tab bar by itself; here the
 * scroll view runs `contentInsetAdjustmentBehavior="never"` under the native tab bar, so the padding
 * carries the whole stack: the bottom safe area, the Scan button's offset and height
 * (ScanFab: 28pt above the safe area, `size.fab` tall), then the xl5 gap. Evidence: TD-01 today-light-bottom.
 */
export function todayBottomPadding(safeAreaBottom: number): number {
  return safeAreaBottom + FAB_BOTTOM_PADDING + size.fab + TODAY_BOTTOM_INSET;
}

export function TodayView({
  model,
  isOffline = false,
  onStartSetup,
  onOpenDiary,
  onOpenHealthSettings,
}: TodayViewProps) {
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  const snapshot = useTodaySnapshot(model);
  const [weekStripVisible, setWeekStripVisible] = useState(true);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);

  // JIT trigger: the Steps card asks for access the first time the screen appears, never at launch.
  useEffect(() => {
    void model.loadStepsIfNeeded();
  }, [model]);

  const goal = goalKcal(snapshot);
  const glasses = waterGlasses(snapshot);

  if (!snapshot.loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="today.scroll"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: todayBottomPadding(insets.bottom) },
        ]}
      >
        <Header
          snapshot={snapshot}
          isOffline={isOffline}
          onToggleWeekStrip={() => setWeekStripVisible((visible) => !visible)}
        />
        {isOffline && (
          <BannerNote
            text="You're offline — logging still works. Changes sync when you're back online."
            variant="info"
          />
        )}
        {weekStripVisible && (
          <WeekStripView
            days={weekStripDays(model.today())}
            selectedDay={snapshot.selectedDay}
            onSelect={model.selectDay}
          />
        )}
        <HeroCard snapshot={snapshot} goal={goal} now={model.today()} onStartSetup={onStartSetup} />
        <MacroSection snapshot={snapshot} />
        <WaterCard waterMl={snapshot.waterMl} glasses={glasses} onTap={() => setWaterSheetOpen(true)} />
        <ScoreAndSteps snapshot={snapshot} onOpenHealthSettings={onOpenHealthSettings} />
        <View testID="today.streakCard">
          <StreakCard
            emoji="🔥"
            streak={snapshot.streak?.currentStreak ?? 0}
            title="Keep it up!"
            freezesLeft={snapshot.streak?.freezesLeft ?? 0}
          />
        </View>
        <RecentMeals snapshot={snapshot} onOpenDiary={onOpenDiary} />
      </ScrollView>

      <Modal
        visible={waterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWaterSheetOpen(false)}
      >
        <View style={styles.sheetHost}>
          <Pressable
            accessibilityLabel="Dismiss"
            style={StyleSheet.absoluteFill}
            onPress={() => setWaterSheetOpen(false)}
          />
          <WaterLogSheet
            totalMl={snapshot.waterMl}
            glasses={glasses}
            onQuickAdd={(delta) => {
              void model.logWaterDelta(delta);
            }}
            onDismiss={() => setWaterSheetOpen(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

function Header({
  snapshot,
  isOffline,
  onToggleWeekStrip,
}: {
  snapshot: TodaySnapshot;
  isOffline: boolean;
  onToggleWeekStrip: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        Today
      </Text>
      <View style={styles.spacer} />
      {isOffline && (
        <View testID="offline.badge">
          <OfflineBadge />
        </View>
      )}
      <Pressable
        testID="today.dateSelector"
        accessibilityRole="button"
        accessibilityLabel="Select date"
        onPress={onToggleWeekStrip}
        style={styles.dateSelector}
      >
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>
          {headerDateText(snapshot.selectedDay)}
        </Text>
        <SymbolView name="chevron.down" size={12} weight="medium" tintColor={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function HeroCard({
  snapshot,
  goal,
  now,
  onStartSetup,
}: {
  snapshot: TodaySnapshot;
  goal: number | null;
  now: Date;
  onStartSetup?: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View style={[styles.card, styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {goal === null ? (
        <View testID="today.emptyState" style={styles.empty}>
          <Text style={[typography.heading, styles.centered, { color: colors.textPrimary }]}>Set up your plan</Text>
          <Text style={[typography.subhead, styles.centered, { color: colors.textSecondary }]}>
            Answer a few questions and we&apos;ll calculate your daily calorie and macro targets.
          </Text>
          <View testID="today.startSetup" style={styles.fullWidth}>
            <PrimaryButton title="Start setup" action={() => onStartSetup?.()} />
          </View>
        </View>
      ) : (
        <>
          <View testID="today.ring">
            <CalorieRing
              consumed={consumedKcal(snapshot)}
              goal={goal}
              variant="hero"
              dayProgress={dayProgress(now)}
            />
          </View>
          <EdSafeCollapse>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>
              {`of ${goalSubheadText(goal)} kcal goal`}
            </Text>
          </EdSafeCollapse>
        </>
      )}
    </View>
  );
}

function MacroSection({ snapshot }: { snapshot: TodaySnapshot }) {
  const { colors } = useTokens();
  const fiber = consumedMacro(snapshot, 'fiber');
  const fiberGoal = goalMacro(snapshot, 'fiber');
  return (
    <View style={styles.macroSection}>
      <View style={styles.macroRow}>
        {(['protein', 'carbs', 'fat'] as const).map((macro) => (
          <MacroMiniCard
            key={macro}
            macro={macro}
            value={consumedMacro(snapshot, macro)}
            goal={goalMacro(snapshot, macro)}
          />
        ))}
      </View>
      <View
        accessible
        accessibilityLabel={`Fiber ${Math.round(fiber)} of ${Math.round(fiberGoal)} grams`}
        style={[styles.card, styles.fiber, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.fiberHeader}>
          <View style={[styles.dot, { backgroundColor: colors.macroFiber }]} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Fiber</Text>
          <View style={styles.spacer} />
          <Text style={[styles.fiberValue, { color: colors.textPrimary }]}>
            {`${Math.round(fiber)}/${Math.round(fiberGoal)}g`}
          </Text>
        </View>
        <MacroBar macro="fiber" value={fiber} goal={fiberGoal} />
      </View>
    </View>
  );
}

function ScoreAndSteps({
  snapshot,
  onOpenHealthSettings,
}: {
  snapshot: TodaySnapshot;
  onOpenHealthSettings?: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View style={styles.statRow}>
      <EdSafeCollapse>
        <StatCard
          testID="today.healthScore"
          caption="Health Score"
          value="—"
          tileTint={withAlpha(colors.success, 0.1)}
          tile={<Text style={[styles.scoreDash, { color: colors.successInk }]}>—</Text>}
        />
      </EdSafeCollapse>
      <StatCard
        testID="today.stepsCard"
        caption="Steps"
        value={stepsDisplayValue(snapshot)}
        tileTint={withAlpha(colors.appleHealth, 0.1)}
        tile={<SymbolView name="figure.walk" size={20} tintColor={colors.appleHealth} />}
        onPress={snapshot.stepsAccessDenied ? onOpenHealthSettings : undefined}
      />
    </View>
  );
}

function StatCard({
  testID,
  caption,
  value,
  tile,
  tileTint,
  onPress,
}: {
  testID: string;
  caption: string;
  value: string;
  tile: ReactNode;
  tileTint: string;
  onPress?: () => void;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityLabel={caption}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[styles.card, styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.statTile, { backgroundColor: tileTint }]}>{tile}</View>
      <View style={styles.statText}>
        <Text style={[typography.footnote, { color: colors.textSecondary }]}>{caption}</Text>
        <Text style={[typography.headline, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </Pressable>
  );
}

function RecentMeals({
  snapshot,
  onOpenDiary,
}: {
  snapshot: TodaySnapshot;
  onOpenDiary?: (day: Date) => void;
}) {
  const { colors } = useTokens();
  return (
    <View style={styles.recent}>
      <View style={styles.recentHeader}>
        <SectionHeader title="Recent meals" />
        <View style={styles.spacer} />
        <Pressable
          testID="today.openDiary"
          accessibilityRole="button"
          accessibilityLabel="Open diary"
          onPress={() => onOpenDiary?.(snapshot.selectedDay)}
          hitSlop={8}
        >
          <Text style={[typography.caption, { color: colors.accentInk }]}>Open diary</Text>
        </Pressable>
      </View>
      <View testID="today.recentMeals">
        {snapshot.meals.map((meal) => (
          <Pressable
            key={meal.id}
            testID="today.foodRow"
            accessibilityRole="button"
            accessibilityLabel={`Meal: ${meal.title}`}
            onPress={() => onOpenDiary?.(meal.loggedAt)}
          >
            <FoodRow
              title={meal.title}
              meta={mealMeta(meal.mealSlot, meal.loggedAt)}
              kcal={meal.kcal ?? undefined}
              compactBadge={
                meal.confidence === null ? undefined : <ConfidenceBadge confidence={meal.confidence} compact />
              }
              syncPending={!meal.isSynced}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  title: { fontSize: 34, fontWeight: '600' },
  spacer: { flex: 1 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  card: { borderWidth: 1, borderRadius: radius.lg },
  hero: { alignItems: 'center', gap: space.md, padding: space.xl },
  empty: { alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  centered: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  macroSection: { gap: space.md },
  macroRow: { flexDirection: 'row', gap: space.sm },
  fiber: { padding: space.md, gap: space.xs },
  fiberHeader: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fiberValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statRow: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  statTile: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  scoreDash: { fontSize: 18, fontWeight: '600' },
  statText: { gap: 2 },
  recent: { gap: space.xs },
  recentHeader: { flexDirection: 'row', alignItems: 'center' },
  sheetHost: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
});
