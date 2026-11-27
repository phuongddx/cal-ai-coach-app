/**
 * ManualLogSheet.swift — manual log from a search row: per-100g basis with a
 * grams stepper or per-serving basis with a servings stepper; the kcal
 * live-recomputes through DiaryMath and is never a typed or stored value.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { DiaryEntryDetail } from '../../../data/repos/diaryEntryRepository';
import type { IdGenerator } from '../../../data/repos/sqlDb';
import { PrimaryButton, Sheet, Stepper, useTokens } from '../../../design';

import { manualKcal, mealName, servingKcal } from '../diaryMath';
import type { FoodSearchRow } from '../foodSearchModel';

export type ManualLogSheetProps = {
  row: FoodSearchRow;
  mealSlot: string;
  onSave: (detail: DiaryEntryDetail) => void;
  onDismiss: () => void;
  newId: IdGenerator;
};

/** ManualLogSheet.servingRange. */
const SERVING_RANGE = { min: 1, max: 50 } as const;

export function ManualLogSheet({ row, mealSlot, onSave, onDismiss, newId }: ManualLogSheetProps) {
  const { colors, typography } = useTokens();
  const [grams, setGrams] = useState(row.servingGrams ?? 100);
  const [servings, setServings] = useState(1);

  const isPerServing = row.basis === 'per_serving';
  const displayedKcal = isPerServing
    ? servingKcal(row.kcal, servings)
    : manualKcal(row.kcal, grams);

  const save = () => {
    const detail: DiaryEntryDetail = {
      entryId: newId(),
      mealSlot,
      title: row.name,
      grams: isPerServing ? (row.servingGrams === null ? null : row.servingGrams * servings) : grams,
      kcal: displayedKcal,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      confidence: null,
      hiddenFatLikely: false,
      source: 'manual',
      unresolved: false,
      scanId: null,
    };
    onSave(detail);
  };

  return (
    <Sheet>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={2}>
            {`Log ${row.name}`}
          </Text>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>
            {isPerServing ? 'Per serving values' : 'Per 100 g values'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="manual.close"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      {isPerServing ? (
        <ServingStepper servings={servings} onServingsChange={setServings} />
      ) : (
        <View testID="manual.stepper">
          <Stepper name={row.name} value={grams} onValueChange={setGrams} />
        </View>
      )}

      <View style={styles.kcalRow}>
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>kcal</Text>
        <Text
          testID="manual.kcal"
          style={[styles.kcalValue, { color: colors.textPrimary }]}
        >
          {`${displayedKcal}`}
        </Text>
      </View>

      <View testID="manual.save">
        <PrimaryButton title={`Save to ${mealName(mealSlot)}`} action={save} />
      </View>
    </Sheet>
  );
}

/**
 * ManualLogSheet.ServingStepper — the stepper visual contract with a servings
 * unit (the DS Stepper is grams-worded); same DS button identifiers.
 */
function ServingStepper({
  servings,
  onServingsChange,
}: {
  servings: number;
  onServingsChange: (servings: number) => void;
}) {
  const { colors, space, radius } = useTokens();
  const clamp = (value: number) =>
    Math.min(Math.max(value, SERVING_RANGE.min), SERVING_RANGE.max);
  return (
    <View
      accessible
      accessibilityLabel="Servings"
      accessibilityValue={{ text: `${servings}` }}
      style={styles.servingRow}
    >
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.decrement"
        onPress={() => onServingsChange(clamp(servings - 1))}
        style={[styles.stepButton, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]}
      >
        <SymbolView name="minus" size={16} weight="semibold" tintColor={colors.textPrimary} />
      </Pressable>
      <Text style={[styles.servingValue, { color: colors.textPrimary }]}>
        {`${servings} serving${servings === 1 ? '' : 's'}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.increment"
        onPress={() => onServingsChange(clamp(servings + 1))}
        style={[styles.stepButton, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm }]}
      >
        <SymbolView name="plus" size={16} weight="semibold" tintColor={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 2 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  kcalValue: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  stepButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 72 },
});
