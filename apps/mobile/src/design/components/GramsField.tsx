/**
 * Grams control (Ember `#scan` review sheet): − / + buttons of 44 pt (`--tap`), step 10, a
 * tappable number field between them and serving chips under it. testIDs are
 * `scan.grams.<id>.decrement`, `.increment` and `.field`. The older `Stepper` keeps its
 * `ccstepper.*` testIDs for the sheets that already use it.
 *
 * The kcal a gram change implies is recomputed by the caller (`KcalArithmetic` invariant); this
 * control only edits grams.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, size, space, typography, useTokens } from '../tokens';

import { ChipOption } from './ChipOption';
import { stepperNext } from './Stepper';

export type GramsServing = { label: string; grams: number };

export type GramsFieldProps = {
  /** Item id: part of the testIDs. */
  id: string;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  minimum?: number;
  maximum?: number;
  /** Optional serving chips (for example "1 slice" = 30 g). */
  servings?: GramsServing[];
};

/** Digits only; the empty string stays empty, a value is clamped into [minimum, maximum]. */
export function parseGramsInput(text: string, minimum: number, maximum: number): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  return Math.min(Math.max(Number.parseInt(digits, 10), minimum), maximum);
}

export function GramsField({
  id,
  value,
  onValueChange,
  step = 10,
  minimum = 0,
  maximum = 9999,
  servings,
}: GramsFieldProps) {
  const { colors } = useTokens();
  const [text, setText] = useState(String(value));

  // An outside change (the buttons, a serving chip) replaces what was typed.
  useEffect(() => {
    setText((current) => (parseGramsInput(current, minimum, maximum) === value ? current : String(value)));
  }, [value, minimum, maximum]);

  const adjust = (delta: number) => {
    onValueChange(Math.min(stepperNext(value, delta, minimum), maximum));
  };

  const buttonStyle = [styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border }];

  return (
    <View style={styles.column}>
      <View
        accessible
        accessibilityLabel="Grams"
        accessibilityValue={{ text: `${value} grams` }}
        testID={`scan.grams.${id}`}
        style={styles.row}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease grams"
          testID={`scan.grams.${id}.decrement`}
          onPress={() => adjust(-step)}
          style={buttonStyle}
        >
          <SymbolView name="minus" size={16} weight="semibold" tintColor={colors.text} />
        </Pressable>
        <View style={[styles.field, { backgroundColor: colors.fill, borderColor: colors.border }]}>
          <TextInput
            testID={`scan.grams.${id}.field`}
            accessibilityLabel="Grams"
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={String(maximum).length}
            value={text}
            onChangeText={(next) => {
              const digits = next.replace(/[^0-9]/g, '');
              setText(digits);
              const parsed = parseGramsInput(digits, minimum, maximum);
              if (parsed != null) onValueChange(parsed);
            }}
            onBlur={() => setText(String(value))}
            style={[styles.input, { color: colors.text }]}
          />
          <Text style={[styles.unit, { color: colors.text2 }]}>g</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase grams"
          testID={`scan.grams.${id}.increment`}
          onPress={() => adjust(step)}
          style={buttonStyle}
        >
          <SymbolView name="plus" size={16} weight="semibold" tintColor={colors.text} />
        </Pressable>
      </View>
      {servings != null && servings.length > 0 && (
        <View style={styles.chips}>
          {servings.map((serving) => (
            <ChipOption
              key={serving.label}
              title={serving.label}
              isSelected={serving.grams === value}
              onSelect={() => onValueChange(serving.grams)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepButton: {
    width: size.tap,
    height: size.tap,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  input: {
    ...typography.headline,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 56,
    paddingVertical: 0,
  },
  unit: {
    ...typography.subhead,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
