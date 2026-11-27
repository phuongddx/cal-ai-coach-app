/**
 * DiaryDayView.swift — the day sheet: date pager, Eaten/Goal/Left summary,
 * the four meal sections with dashed add buttons, the exercise section, the
 * saved toast with Undo, the delete confirmation and the sheet stack (add
 * food, exercise). The kcal clauses collapse through EdSafeCollapse — the
 * components own that policy (I7); the feature holds no ED-safe branch.
 */
import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  ConfidenceBadge,
  DashedAddButton,
  EdSafeCollapse,
  FoodRow,
  Toast,
  useEdSafeMode,
  useTokens,
  withAlpha,
} from '../../../design';

import type { DiaryDeps } from '../deps';
import { mealName, slotEmoji } from '../diaryMath';
import type { DiaryDayExercise, DiaryDayItem } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';
import type { ScanMode, SavedReceipt } from '../addFoodModel';
import { AddFoodSheetRoute } from './AddFoodSheet';
import { ExerciseLogSheet } from './ExerciseLogSheet';

export type DiaryDayViewProps = {
  model: DiaryDayModel;
  deps: DiaryDeps;
  /** The scan hand-over (the route file's navigation callback). */
  onCapture: (mode: ScanMode) => void;
};

const DAY_MS = 86_400_000;

export function DiaryDayView({ model, deps, onCapture }: DiaryDayViewProps) {
  const { colors, radius, space, typography } = useTokens();
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);

  const [pendingDelete, setPendingDelete] = useState<DiaryDayItem | null>(null);
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
          <PagerButton
            symbol="chevron.left"
            label="Previous day"
            identifier="diary.previousDay"
            onPress={() => shiftDay(model, -1)}
          />
          <Text style={[typography.heading, { color: colors.textPrimary }]}>{model.dayHeading()}</Text>
          <PagerButton
            symbol="chevron.right"
            label="Next day"
            identifier="diary.nextDay"
            onPress={() => shiftDay(model, 1)}
            disabled={model.isToday()}
          />
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
              <Text accessibilityRole="header" style={[typography.headline, { color: colors.textPrimary }]}>
                {`${slotEmoji(section.slot)} ${mealName(section.slot)}`}
              </Text>
              <EdSafeCollapse>
                <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                  {`${model.sectionKcal(section)} kcal`}
                </Text>
              </EdSafeCollapse>
            </View>
            {section.items.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
                {section.items.map((item) => (
                  <FoodItemRow key={item.id} item={item} onDelete={() => setPendingDelete(item)} />
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
        <View style={[styles.dialogBackdrop, { backgroundColor: withAlpha('#000000', 0.45) }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>
              {`Delete ${pendingDelete?.title ?? ''}?`}
            </Text>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>
              {`This will remove it from ${pendingDelete === null ? '' : mealName(pendingDelete.mealSlot)}. This can't be undone.`}
            </Text>
            <View style={styles.dialogButtons}>
              <Pressable
                accessibilityRole="button"
                onPress={() => pendingDelete !== null && onDeleteConfirm(pendingDelete)}
                style={styles.dialogButton}
              >
                <Text style={[typography.body, { color: colors.errorInk }]}>Delete</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPendingDelete(null)}
                style={styles.dialogButton}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>Cancel</Text>
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

function PagerButton({
  symbol,
  label,
  identifier,
  onPress,
  disabled = false,
}: {
  symbol: 'chevron.left' | 'chevron.right';
  label: string;
  identifier: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={identifier}
      style={[styles.pagerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <SymbolView name={symbol} size={14} weight="semibold" tintColor={colors.textSecondary} />
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

function FoodItemRow({ item, onDelete }: { item: DiaryDayItem; onDelete: () => void }) {
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Delete, ${item.title}`}
      testID="diary.foodRow"
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
  );
}

function ExerciseRowView({ exercise }: { exercise: DiaryDayExercise }) {
  const { colors, typography } = useTokens();
  const edSafe = useEdSafeMode();
  const showsKcal = exercise.kcalBurned !== null && !edSafe;
  return (
    <View
      accessible
      testID="diary.exerciseRow"
      style={styles.exerciseRow}
      accessibilityLabel={
        showsKcal
          ? `${exercise.type}, ${exercise.durationMin} minutes, ${exercise.kcalBurned} kcal`
          : `${exercise.type}, ${exercise.durationMin} minutes`
      }
    >
      <View style={[styles.exerciseTile, { backgroundColor: colors.fill, borderRadius: 10 }]}>
        <SymbolView name="figure.run" size={14} tintColor={colors.textTertiary} />
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
          <Text style={[styles.exerciseKcal, typography.body, { color: colors.textSecondary }]}>
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
  pagerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 16 },
  summaryColumn: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  divider: { width: StyleSheet.hairlineWidth, height: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCard: { overflow: 'hidden', paddingHorizontal: 12 },
  exerciseHeader: { marginTop: 8 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  exerciseTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  exerciseText: { flex: 1, gap: 2 },
  exerciseKcal: { fontWeight: '500', fontVariant: ['tabular-nums'] },
  toastOverlay: { position: 'absolute', top: 8, left: 16, right: 16 },
  dialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogCard: { width: '100%', padding: 16, gap: 8 },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 8 },
  dialogButton: { paddingVertical: 8 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
