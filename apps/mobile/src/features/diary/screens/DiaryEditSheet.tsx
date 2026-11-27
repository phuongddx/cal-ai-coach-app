/**
 * DiaryEditSheet — the edit sheet of a diary food row (DY-08, new in Ember).
 * The Review-frame grams control at diary scale: the 44 pt steppers, the
 * tappable grams field and the ruler. The kcal shown recomputes from the new
 * grams over the entry's stored per-100g basis (KcalArithmetic); the save
 * rewrites the entry through the model's one-batch update and never types a
 * kcal. The kcal figure collapses under ED-Safe; grams stay editable.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  EdSafeCollapse,
  GramsRuler,
  Icon,
  PrimaryButton,
  Sheet,
  SheetHeader,
  parseGramsInput,
  useTokens,
} from '../../../design';

import { manualKcal, mealName } from '../diaryMath';
import type { DiaryDayItem } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';

export type DiaryEditSheetProps = {
  item: DiaryDayItem;
  model: DiaryDayModel;
  onDismiss: () => void;
};

const GRAMS_RANGE = { min: 0, max: 9999 } as const;
/** The ruler shows the everyday range; the field and steppers clamp wider. */
const RULER_RANGE = { min: 0, max: 500 } as const;
const GRAMS_STEP = 10;

export function DiaryEditSheet({ item, model, onDismiss }: DiaryEditSheetProps) {
  const { colors, radius, space, typography } = useTokens();
  const [grams, setGrams] = useState(item.grams ?? 0);

  // The entry's own per-100g basis (kcal / grams × 100); without a stored
  // basis there is nothing to recompute from and the stored kcal is kept.
  const basis =
    item.kcal !== null && item.grams !== null && item.grams > 0
      ? (item.kcal / item.grams) * 100
      : null;
  const displayedKcal = basis === null ? item.kcal : manualKcal(basis, grams);

  const clamp = (value: number) => Math.min(Math.max(value, GRAMS_RANGE.min), GRAMS_RANGE.max);

  const save = () => {
    void model.updateEntry(item, clamp(grams)).then(onDismiss);
  };

  return (
    <Sheet>
      <SheetHeader title={item.title} onClose={onDismiss} testID="diary.edit" />

      {displayedKcal !== null && (
        <EdSafeCollapse>
          <View style={styles.kcalRow}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>kcal</Text>
            <Text style={[styles.kcalValue, typography.body, { color: colors.textPrimary }]}>
              {`${displayedKcal}`}
            </Text>
          </View>
        </EdSafeCollapse>
      )}

      <View testID={`diary.edit.grams.${item.id}`} style={styles.gramsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${item.title} by ${GRAMS_STEP} grams`}
          testID="ccstepper.decrement"
          onPress={() => setGrams(clamp(grams - GRAMS_STEP))}
          style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border, borderRadius: radius.sm }]}
        >
          <Icon name="minus" size={16} color={colors.textPrimary} />
        </Pressable>
        <TextInput
          value={`${grams}`}
          onChangeText={(text) => {
            const parsed = parseGramsInput(text, GRAMS_RANGE.min, GRAMS_RANGE.max);
            if (parsed !== null) {
              setGrams(parsed);
            }
          }}
          keyboardType="number-pad"
          accessibilityLabel={`Grams of ${item.title}`}
          style={[
            styles.gramsField,
            typography.body,
            { color: colors.textPrimary, backgroundColor: colors.fill, borderColor: colors.border, borderRadius: radius.sm },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${item.title} by ${GRAMS_STEP} grams`}
          testID="ccstepper.increment"
          onPress={() => setGrams(clamp(grams + GRAMS_STEP))}
          style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border, borderRadius: radius.sm }]}
        >
          <Icon name="plus" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>

      <GramsRuler
        value={grams}
        onChange={setGrams}
        min={RULER_RANGE.min}
        max={RULER_RANGE.max}
        accessibilityLabel={`Grams ruler of ${item.title}`}
        testID={`diary.edit.grams.${item.id}.ruler`}
      />

      <View testID="diary.edit.save">
        <PrimaryButton title={`Save to ${mealName(item.mealSlot)}`} action={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kcalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  kcalValue: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stepButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsField: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
