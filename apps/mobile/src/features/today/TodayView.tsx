/**
 * TodayView — the Today screen on Ember (U-76; frames Today light, dark offline, ED-Safe). Built from the
 * design system on the tokens. The ED-safe policy is owned by the components (invariant I7): the ring (with
 * its `aside` and `edSafeAside`), the food rows and the collapse wrapper read the mode themselves; nothing in
 * this file branches on it.
 *
 * Identifiers: each Swift `accessibilityIdentifier` is the `testID` of the same element; the ones U-76 adds
 * are listed in `docs/rn-migration/parity-detail/today.md`.
 */
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CalorieRing,
  ConfidenceBadge,
  EdSafeCollapse,
  EmberCard,
  FoodRow,
  GlassIconButton,
  Icon,
  MacroBar,
  PrimaryButton,
  SectionHeader,
  fontFamily,
  radius,
  size,
  space,
  streakA11yLabel,
  textStyles,
  useTokens,
} from '../../design';
import { WaterCard, WaterLogSheet } from '../diary/screens/WaterCard';

import { FAB_BOTTOM_PADDING } from './ScanFab';
import {
  OFFLINE_CHIP_TEXT,
  edSafeGuidance,
  freezeLineText,
  groupedNumber,
  headerSubtitleText,
  macroValueText,
  mealMeta,
  pendingMealMeta,
  streakTitleText,
} from './todayFormat';
import {
  consumedKcal,
  consumedMacro,
  dayProgress,
  goalKcal,
  goalMacro,
  waterGlasses,
  weekStripDays,
  type MacroName,
  type TodayModel,
  type TodaySnapshot,
} from './todayModel';
import { useTodaySnapshot } from './useTodayModel';
import { WeekStripView } from './WeekStripView';

export type TodayViewProps = {
  model: TodayModel;
  isOffline?: boolean;
  onStartSetup?: () => void;
  /** A meal row, the header calendar button or the "Diary" link opens the diary day sheet for this day. */
  onOpenDiary?: (day: Date) => void;
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

export function TodayView({ model, isOffline = false, onStartSetup, onOpenDiary }: TodayViewProps) {
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  const snapshot = useTodaySnapshot(model);
  const [weekStripVisible, setWeekStripVisible] = useState(true);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);

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
          onOpenDiary={() => onOpenDiary?.(snapshot.selectedDay)}
        />
        {weekStripVisible && (
          <WeekStripView
            days={weekStripDays(model.today())}
            selectedDay={snapshot.selectedDay}
            onSelect={model.selectDay}
          />
        )}
        <HeroCard snapshot={snapshot} goal={goal} now={model.today()} onStartSetup={onStartSetup} />
        <MacroGrid snapshot={snapshot} />
        <WaterCard waterMl={snapshot.waterMl} glasses={glasses} onTap={() => setWaterSheetOpen(true)} />
        <StreakRow snapshot={snapshot} />
        <Meals snapshot={snapshot} onOpenDiary={onOpenDiary} />
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

/** Frame header: the date over the title on the left; the caution chip (offline) and the calendar glass button on the right. */
function Header({
  snapshot,
  isOffline,
  onToggleWeekStrip,
  onOpenDiary,
}: {
  snapshot: TodaySnapshot;
  isOffline: boolean;
  onToggleWeekStrip: () => void;
  onOpenDiary: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Pressable
          testID="today.dateSelector"
          accessibilityRole="button"
          accessibilityLabel="Select date"
          accessibilityHint="Shows or hides the week strip"
          onPress={onToggleWeekStrip}
          hitSlop={8}
        >
          <Text style={[styles.subtitle, { color: colors.text2 }]}>{headerSubtitleText(snapshot.selectedDay)}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Today
        </Text>
      </View>
      {isOffline && (
        <View
          testID="offline.badge"
          accessible
          accessibilityLabel={OFFLINE_CHIP_TEXT}
          style={[styles.offlineChip, { backgroundColor: colors.cautionTint }]}
        >
          <Text style={[styles.offlineText, { color: colors.cautionInk }]} numberOfLines={1}>
            {OFFLINE_CHIP_TEXT}
          </Text>
        </View>
      )}
      <GlassIconButton icon="cal" accessibilityLabel="Open diary" testID="today.openDiary" onPress={onOpenDiary} />
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
  if (goal === null) {
    return (
      <View style={[styles.card, styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View testID="today.emptyState" style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Set up your plan</Text>
          <Text style={[styles.emptyBody, { color: colors.text2 }]}>
            Answer a few questions and we&apos;ll calculate your daily calorie and macro targets.
          </Text>
          <View testID="today.startSetup" style={styles.fullWidth}>
            <PrimaryButton title="Start setup" action={() => onStartSetup?.()} />
          </View>
        </View>
      </View>
    );
  }
  const eaten = consumedKcal(snapshot);
  const guidance = edSafeGuidance(now);
  return (
    <EmberCard>
      <View testID="today.ring">
        <CalorieRing
          consumed={eaten}
          goal={goal}
          variant="md"
          onEmber
          centerLabel="kcal left"
          dayProgress={dayProgress(now)}
          aside={
            <View style={styles.asideColumn}>
              <KcalFigure testID="today.eaten" label="Eaten" value={groupedNumber(eaten)} />
              <KcalFigure testID="today.goalKcal" label="Goal" value={groupedNumber(goal)} />
            </View>
          }
          edSafeAside={
            <View>
              <View
                testID="today.edSafeGuidance"
                accessible
                accessibilityLabel={`${guidance.lead} ${guidance.next}`}
              >
                <Text style={[styles.guidance, { color: colors.emberText2 }]}>
                  {`${guidance.lead} `}
                  <Text style={{ color: colors.emberText }}>{guidance.next}</Text>
                </Text>
              </View>
              {/* The kcal figures keep their identifiers on collapsed wrappers (frame 09). */}
              <View style={styles.collapsed}>
                <View testID="today.eaten" />
                <View testID="today.goalKcal" />
              </View>
            </View>
          }
        />
      </View>
    </EmberCard>
  );
}

/** One "Eaten" / "Goal" pair of the ember card; hidden under ED-safe by the ring's aside choice, plus the collapse wrapper. */
function KcalFigure({ testID, label, value }: { testID: string; label: string; value: string }) {
  const { colors } = useTokens();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label} ${value} kilocalories`}>
      <EdSafeCollapse>
        <Text style={[styles.figureLabel, { color: colors.emberText2 }]}>{label}</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.figureValue, { color: colors.emberText }]}
        >
          {value}
        </Text>
      </EdSafeCollapse>
    </View>
  );
}

const MACRO_LABELS: Record<MacroName, string> = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber' };

/** The 2 by 2 grid of the frame: two rows of two cells, labels and values on one line. */
function MacroGrid({ snapshot }: { snapshot: TodaySnapshot }) {
  const { colors } = useTokens();
  const rows: MacroName[][] = [
    ['protein', 'carbs'],
    ['fat', 'fiber'],
  ];
  return (
    <View style={[styles.card, styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {rows.map((row) => (
        <View key={row.join('-')} testID="today.macroRow" style={styles.macroRow}>
          {row.map((macro) => {
            const value = consumedMacro(snapshot, macro);
            const goal = goalMacro(snapshot, macro);
            return (
              <View
                key={macro}
                testID={`today.macroCard.${macro}`}
                accessible
                accessibilityLabel={`${MACRO_LABELS[macro]} ${Math.round(value)} of ${Math.round(goal)} grams`}
                style={styles.macroCell}
              >
                <View style={styles.macroText}>
                  <Text numberOfLines={1} style={[styles.macroLabel, { color: colors.text2 }]}>
                    {MACRO_LABELS[macro]}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={[styles.macroValue, { color: colors.text }]}
                  >
                    {macroValueText(value, goal)}
                  </Text>
                </View>
                <MacroBar macro={macro} value={value} goal={goal} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Streak card of the frames: flame tile, "12-day streak" and the freeze line. Shown in every mode. */
function StreakRow({ snapshot }: { snapshot: TodaySnapshot }) {
  const { colors } = useTokens();
  const days = snapshot.streak?.currentStreak ?? 0;
  const freezes = snapshot.streak?.freezesLeft ?? 0;
  return (
    <View testID="today.streakCard">
      <View
        accessible
        accessibilityLabel={streakA11yLabel(days, freezes)}
        style={[styles.card, styles.streak, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.streakTile, { backgroundColor: colors.accentTint }]}>
          <Icon name="flame" size={22} color={colors.accentInk} />
        </View>
        <View style={styles.streakText}>
          <Text style={[styles.streakTitle, { color: colors.text }]}>{streakTitleText(days)}</Text>
          <Text style={[styles.streakLine, { color: colors.text2 }]}>{freezeLineText(freezes)}</Text>
        </View>
      </View>
    </View>
  );
}

function Meals({ snapshot, onOpenDiary }: { snapshot: TodaySnapshot; onOpenDiary?: (day: Date) => void }) {
  const { colors } = useTokens();
  return (
    <View style={styles.meals}>
      <View style={styles.mealsHeader}>
        <SectionHeader title="Meals" />
        <View style={styles.spacer} />
        <Pressable
          testID="today.mealsDiary"
          accessibilityRole="button"
          accessibilityLabel="Diary"
          onPress={() => onOpenDiary?.(snapshot.selectedDay)}
          hitSlop={8}
          style={styles.diaryLink}
        >
          <Text style={[styles.diaryLinkText, { color: colors.accentInk }]}>Diary</Text>
        </Pressable>
      </View>
      <View
        testID="today.recentMeals"
        style={[styles.card, styles.mealsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {snapshot.meals.length === 0 && (
          <Text style={[styles.noMeals, { color: colors.text2 }]}>No meals logged yet</Text>
        )}
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
              meta={pendingMealMeta(mealMeta(meal.mealSlot, meal.loggedAt), !meal.isSynced)}
              kcal={meal.kcal ?? undefined}
              compactBadge={
                meal.confidence === null ? undefined : <ConfidenceBadge confidence={meal.confidence} compact />
              }
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerText: { flex: 1, minWidth: 0 },
  subtitle: { fontSize: textStyles.subheadline.fontSize, fontWeight: '500' },
  title: { fontSize: textStyles.largeTitle.fontSize, lineHeight: textStyles.largeTitle.lineHeight, fontWeight: '700' },
  offlineChip: {
    height: 32,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: { fontSize: textStyles.footnote.fontSize, fontWeight: '600' },
  spacer: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg },
  hero: { alignItems: 'center', padding: space.xl },
  empty: { alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  emptyTitle: { fontSize: textStyles.title2.fontSize, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: textStyles.subheadline.fontSize, textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  asideColumn: { gap: space.md },
  figureLabel: { fontSize: textStyles.footnote.fontSize, fontWeight: '500' },
  figureValue: { fontSize: 20, lineHeight: 24, fontWeight: '700', fontFamily: fontFamily.round, fontVariant: ['tabular-nums'] },
  guidance: { fontSize: textStyles.body.fontSize - 2, lineHeight: 22 },
  collapsed: { height: 0, overflow: 'hidden' },
  macroCard: { padding: space.lg, gap: space.lg },
  macroRow: { flexDirection: 'row', gap: space.lg },
  macroCell: { flex: 1, minWidth: 0, gap: space.sm },
  macroText: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  macroLabel: { fontSize: textStyles.footnote.fontSize, fontWeight: '500' },
  macroValue: { flexShrink: 1, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  streakTile: { width: size.tap, height: size.tap, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  streakText: { flex: 1, gap: 2 },
  streakTitle: { fontSize: 16, fontWeight: '600' },
  streakLine: { fontSize: textStyles.footnote.fontSize },
  meals: { gap: space.sm },
  mealsHeader: { flexDirection: 'row', alignItems: 'center' },
  diaryLink: { minHeight: size.tap, justifyContent: 'center' },
  diaryLinkText: { fontSize: textStyles.subheadline.fontSize, fontWeight: '600' },
  mealsCard: { paddingHorizontal: space.md },
  noMeals: { fontSize: textStyles.subheadline.fontSize, paddingVertical: space.lg, textAlign: 'center' },
  sheetHost: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
});
