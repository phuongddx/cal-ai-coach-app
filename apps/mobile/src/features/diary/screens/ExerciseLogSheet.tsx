/**
 * ExerciseLogSheet.swift — the exercise sheet: a type field, the 5-minute
 * duration stepper, and an optional burned-kcal field clamped 0–5000 at the
 * model boundary (the repository clamps again). Local-only write (I4).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  EdSafeCollapse,
  EdSafeNote,
  Icon,
  PrimaryButton,
  Sheet,
  SheetHeader,
  useTokens,
} from '../../../design';

import type { DiaryDayModel } from '../diaryDayModel';

export type ExerciseLogSheetProps = {
  model: DiaryDayModel;
  onDismiss: () => void;
};

const DURATION_STEP = 5;
const DURATION_RANGE = { min: 0, max: 600 } as const;
const KCAL_RANGE = { min: 0, max: 5000 } as const;

export function ExerciseLogSheet({ model, onDismiss }: ExerciseLogSheetProps) {
  const { colors, radius, space, typography } = useTokens();
  const [type, setType] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [kcalText, setKcalText] = useState('');

  const clampedBurnedKcal = (() => {
    if (!/^[+-]?\d+$/.test(kcalText)) {
      return null;
    }
    return Math.min(Math.max(Number(kcalText), KCAL_RANGE.min), KCAL_RANGE.max);
  })();

  const canSave = type.trim().length > 0;

  const save = () => {
    const trimmed = type.trim();
    void model.addExercise(trimmed, durationMin, clampedBurnedKcal).then(onDismiss);
  };

  return (
    <Sheet>
      <SheetHeader title="Add exercise" onClose={onDismiss} testID="exercise" />

      <TextInput
        value={type}
        onChangeText={setType}
        placeholder="Exercise type"
        placeholderTextColor={colors.textTertiary}
        testID="exercise.typeField"
        style={[
          styles.field,
          typography.body,
          {
            color: colors.textPrimary,
            backgroundColor: colors.fill,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
          },
        ]}
      />

      <DurationStepper value={durationMin} onValueChange={setDurationMin} />

      <EdSafeCollapse>
        <TextInput
          value={kcalText}
          onChangeText={setKcalText}
          placeholder="Calories burned (optional)"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          testID="exercise.kcalField"
          style={[
            styles.field,
            typography.body,
            {
              color: colors.textPrimary,
              backgroundColor: colors.fill,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
            },
          ]}
        />
      </EdSafeCollapse>

      <EdSafeNote title="Activity and minutes only." body="Burned kcal is hidden." />

      <View testID="exercise.save">
        <PrimaryButton title="Save" action={save} disabled={!canSave} />
      </View>
    </Sheet>
  );
}

/**
 * ExerciseLogSheet.DurationStepper — the stepper visual contract with a minute
 * unit; same DS button identifiers, 5-minute steps clamped to 0–600.
 */
function DurationStepper({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const { colors, radius } = useTokens();
  const clamp = (next: number) =>
    Math.min(Math.max(next, DURATION_RANGE.min), DURATION_RANGE.max);
  return (
    <View
      accessible
      accessibilityLabel="Duration"
      accessibilityValue={{ text: `${value} minutes` }}
      style={styles.durationRow}
    >
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.decrement"
        onPress={() => onValueChange(clamp(value - DURATION_STEP))}
        style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border, borderRadius: radius.sm }]}
      >
        <Icon name="minus" size={16} color={colors.textPrimary} />
      </Pressable>
      <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{`${value} min`}</Text>
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.increment"
        onPress={() => onValueChange(clamp(value + DURATION_STEP))}
        style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border, borderRadius: radius.sm }]}
      >
        <Icon name="plus" size={16} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { borderWidth: 1 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  stepButton: { width: 32, height: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  durationValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 48 },
});
