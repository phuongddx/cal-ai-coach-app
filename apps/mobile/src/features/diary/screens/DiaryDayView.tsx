/**
 * DiaryDayView.swift — the day sheet: date pager, Eaten/Goal/Left summary,
 * the four meal sections with dashed add buttons, the exercise section, the
 * saved toast with Undo, the delete confirmation and the sheet stack (add
 * food, exercise). The kcal clauses collapse through EdSafeCollapse — the
 * components own that policy (I7); the feature holds no ED-safe branch.
 */
import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ConfidenceBadge,
  DashedAddButton,
  EdSafeCollapse,
  FoodRow,
  GlassIconButton,
  Icon,
  Toast,
  glassIconButtonColors,
  useTokens,
  withAlpha,
  type IconName,
} from '../../../design';

import type { DiaryDeps } from '../deps';
import { mealName } from '../diaryMath';
import type { DiaryDayExercise, DiaryDayItem } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';
import type { ScanMode, SavedReceipt } from '../addFoodModel';
import { AddFoodSheetRoute } from './AddFoodSheet';
import { DiaryEditSheet } from './DiaryEditSheet';
import { ExerciseLogSheet } from './ExerciseLogSheet';

export type DiaryDayViewProps = {
  model: DiaryDayModel;
  deps: DiaryDeps;
  /** The scan hand-over (the route file's navigation callback). */
  onCapture: (mode: ScanMode) => void;
};

const DAY_MS = 86_400_000;

/** The canvas's meal icons (no emoji); the 51-icon set carries no carrot, so snacks draws the apple. */
const SLOT_ICONS: Record<string, IconName> = {
  breakfast: 'sunrise',
  lunch: 'sun',
  dinner: 'moon',
  snacks: 'apple',
};

export function DiaryDayView({ model, deps, onCapture }: DiaryDayViewProps) {
  const { colors, radius, space, typography } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);

  const [pendingDelete, setPendingDelete] = useState<DiaryDayItem | null>(null);
  const [editItem, setEditItem] = useState<DiaryDayItem | null>(null);
  const [isExerciseSheetPresented, setIsExerciseSheetPresented] = useState(false);
  const [addFoodSlot, setAddFoodSlot] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<SavedReceipt | null>(null);

  const snapshot = model.getSnapshot();

  const undo = (receipt: SavedReceipt) => {
    setSavedToast(null);
    for (const entryId of receipt.entryIds) {
      void model.deleteEntry(entryId);
    }
  };

  const onDeleteConfirm = (item: DiaryDayItem) => {
    setPendingDelete(null);
    void model.delete(item);
  };

  const onManualSaved = (receipt: SavedReceipt) => {
    setAddFoodSlot(null);
    setSavedToast(receipt);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.grouped }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.datePager}>
          <GlassIconButton
            icon="back"
            accessibilityLabel="Previous day"
            testID="diary.previousDay"
            onPress={() => shiftDay(model, -1)}
          />
          <Text style={[typography.heading, { color: colors.textPrimary }]}>{model.dayHeading()}</Text>
          {/* GlassIconButton cannot express `disabled`, which the next-day
              pager needs on today: the same DS glass tokens style a feature
              Pressable that carries the state (findings, U-74 §3). */}
          <NextDayGlassButton isToday={model.isToday()} onPress={() => shiftDay(model, 1)} />
        </View>

        <EdSafeCollapse>
          <View
            accessible
            accessibilityLabel={`Eaten ${model.eatenKcal()} of ${model.goalKcal() ?? 0}, ${model.leftKcal() ?? 0} remaining`}
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <SummaryColumn title="Eaten" kcal={model.eatenKcal()} color={colors.textPrimary} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SummaryColumn title="Goal" kcal={model.goalKcal() ?? 0} color={colors.textPrimary} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SummaryColumn title="Left" kcal={model.leftKcal() ?? 0} color={colors.accentInk} />
          </View>
        </EdSafeCollapse>

        {snapshot.sections.map((section) => (
          <View key={section.slot}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <Icon name={SLOT_ICONS[section.slot] ?? 'fork'} size={16} color={colors.textPrimary} />
                <Text accessibilityRole="header" style={[typography.headline, { color: colors.textPrimary }]}>
                  {mealName(section.slot)}
                </Text>
              </View>
              <EdSafeCollapse>
                <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                  {`${model.sectionKcal(section)} kcal`}
                </Text>
              </EdSafeCollapse>
            </View>
            {section.items.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
                {section.items.map((item) => (
                  <FoodItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditItem(item)}
                    onDelete={() => setPendingDelete(item)}
                  />
                ))}
              </View>
            )}
            <View testID={`diary.addFood.${section.slot}`}>
              <DashedAddButton title={`Add ${section.slot}`} action={() => setAddFoodSlot(section.slot)} />
            </View>
          </View>
        ))}

        <View style={[styles.sectionHeader, styles.exerciseHeader]}>
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.textPrimary }]}>
            Exercise
          </Text>
          <EdSafeCollapse>
            {model.burnedKcal() !== null && (
              <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                {`\u2212${model.burnedKcal()} kcal`}
              </Text>
            )}
          </EdSafeCollapse>
        </View>
        {snapshot.exercises.map((exercise) => (
          <ExerciseRowView key={exercise.id} exercise={exercise} />
        ))}
        <View testID="diary.addExercise">
          <DashedAddButton title="Add exercise" action={() => setIsExerciseSheetPresented(true)} />
        </View>
      </ScrollView>

      {savedToast !== null && (
        <View style={styles.toastOverlay} pointerEvents="box-none" testID="diary.toast">
          <Toast
            title={`Saved to ${savedToast.mealName}`}
            kcalText={savedToast.kcalText ?? undefined}
            onUndo={() => undo(savedToast)}
            onDismiss={() => setSavedToast(null)}
          />
        </View>
      )}

      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        {/* The d-delete confirm: two stacked action-sheet cards over a scrim. */}
        <View style={[styles.dialogBackdrop, { backgroundColor: withAlpha('#000000', 0.45) }]}>
          <View style={styles.dialogStack}>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
              <Text style={[typography.headline, { color: colors.textPrimary, textAlign: 'center' }]}>
                {`Delete ${pendingDelete?.title ?? ''}?`}
              </Text>
              <Text style={[typography.subhead, { color: colors.textSecondary, textAlign: 'center' }]}>
                {pendingDelete === null
                  ? ''
                  : pendingDelete.kcal !== null
                    ? `This removes ${pendingDelete.kcal} kcal from ${mealName(pendingDelete.mealSlot)}.`
                    : `This will remove it from ${mealName(pendingDelete.mealSlot)}. This can't be undone.`}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => pendingDelete !== null && onDeleteConfirm(pendingDelete)}
                style={styles.dialogButton}
              >
                <Text style={[typography.body, { color: colors.errorInk, fontWeight: '600' }]}>Delete item</Text>
              </Pressable>
            </View>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPendingDelete(null)}
                style={styles.dialogButton}
              >
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isExerciseSheetPresented}
        animationType="slide"
        transparent
        onRequestClose={() => setIsExerciseSheetPresented(false)}
      >
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.background }]}>
          <ExerciseLogSheet model={model} onDismiss={() => setIsExerciseSheetPresented(false)} />
        </View>
      </Modal>

      <Modal
        visible={editItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditItem(null)}
      >
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.background }]}>
          {editItem !== null && (
            <DiaryEditSheet
              item={editItem}
              model={model}
              onDismiss={() => setEditItem(null)}
              onDelete={(item) => {
                setEditItem(null);
                setPendingDelete(item);
              }}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={addFoodSlot !== null}
        animationType="slide"
        onRequestClose={() => setAddFoodSlot(null)}
      >
        {addFoodSlot !== null && (
          <AddFoodSheetRoute
            mealSlot={addFoodSlot}
            deps={deps}
            onSaved={onManualSaved}
            onDismiss={() => setAddFoodSlot(null)}
            onCapture={onCapture}
          />
        )}
      </Modal>
    </View>
  );
}

/** Calendar-style day shift on the local calendar (local-midnight anchored). */
function shiftDay(model: DiaryDayModel, days: number): void {
  const day = model.getDay();
  model.selectDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days, day.getHours(), day.getMinutes()));
}

/** The next-day pager: the DS glass look with the `disabled` state GlassIconButton cannot carry. */
function NextDayGlassButton({ isToday, onPress }: { isToday: boolean; onPress: () => void }) {
  const { colors, isDark } = useTokens();
  const glass = glassIconButtonColors(colors, isDark, 'onSurface');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Next day"
      accessibilityState={{ disabled: isToday }}
      disabled={isToday}
      onPress={onPress}
      testID="diary.nextDay"
      style={[
        styles.pagerGlass,
        { backgroundColor: glass.background, borderColor: glass.border },
      ]}
    >
      <Icon name="chev" size={22} color={glass.glyph} />
    </Pressable>
  );
}

function SummaryColumn({ title, kcal, color }: { title: string; kcal: number; color: string }) {
  const { colors, typography } = useTokens();
  return (
    <View style={styles.summaryColumn}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.summaryValue, typography.body, { color }]}>{kcal.toLocaleString('en-US')}</Text>
    </View>
  );
}

function FoodItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: DiaryDayItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, typography } = useTokens();
  // The frame's row caption: the grams, then the source when the detail has
  // one and no confidence badge takes the slot. Show what the row has.
  const metaParts: string[] = [];
  if (item.grams !== null) {
    metaParts.push(`${item.grams} g`);
  }
  if (item.confidence === null && item.source === 'manual') {
    // Every manual log is logged from the search flow (FoodSearchView is the
    // only ManualLogSheet entry), so its frame caption is "from search".
    metaParts.push('from search');
  }
  const time = item.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <View testID={`diary.editFood.${item.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit, ${item.title}`}
        testID="diary.foodRow"
        onPress={onEdit}
        onLongPress={onDelete}
      >
        <FoodRow
          title={item.title}
          meta={metaParts.length > 0 ? metaParts.join(' · ') : time}
          kcal={item.kcal ?? undefined}
          compactBadge={
            item.confidence !== null ? <ConfidenceBadge confidence={item.confidence} compact /> : undefined
          }
          syncPending={!item.isSynced}
        />
      </Pressable>
    </View>
  );
}

function ExerciseRowView({ exercise }: { exercise: DiaryDayExercise }) {
  const { colors, typography } = useTokens();
  return (
    <View accessible testID="diary.exerciseRow" style={styles.exerciseRow}>
      <View style={[styles.exerciseTile, { backgroundColor: colors.fill, borderRadius: 10 }]}>
        <Icon name="run" size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.exerciseText}>
        <Text style={[typography.headline, { color: colors.textPrimary }]} numberOfLines={1}>
          {titleCase(exercise.type)}
        </Text>
        <Text style={[typography.footnote, { color: colors.textSecondary }]}>
          {`${exercise.durationMin} min`}
        </Text>
      </View>
      <EdSafeCollapse>
        {exercise.kcalBurned !== null && (
          <Text
            style={[styles.exerciseKcal, typography.body, { color: colors.textSecondary }]}
            accessibilityLabel={`${exercise.kcalBurned} kcal`}
          >
            {`${exercise.kcalBurned}`}
          </Text>
        )}
      </EdSafeCollapse>
    </View>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  datePager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagerGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 16 },
  summaryColumn: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  divider: { width: StyleSheet.hairlineWidth, height: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCard: { overflow: 'hidden', paddingHorizontal: 12 },
  exerciseHeader: { marginTop: 8 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  exerciseTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  exerciseText: { flex: 1, gap: 2 },
  exerciseKcal: { fontWeight: '500', fontVariant: ['tabular-nums'] },
  toastOverlay: { position: 'absolute', top: 8, left: 16, right: 16 },
  dialogBackdrop: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  dialogStack: { width: '100%', gap: 8 },
  dialogCard: { padding: 16, gap: 8, alignItems: 'center' },
  dialogButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
