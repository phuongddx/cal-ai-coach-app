/**
 * CCStepper (Components/Controls.swift). Minus/plus steppers around a gram
 * value; steps of 10, clamped at the minimum. Ember: 44 pt buttons (`--tap`). Both buttons funnel through one
 * adjust() exactly as the Swift adjust(_ direction:) does.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, size, space, typography, useTokens } from '../tokens';

export type StepperProps = {
  name: string;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  minimum?: number;
};

export function stepperNext(value: number, delta: number, minimum: number): number {
  return Math.max(value + delta, minimum);
}

export function Stepper({
  name,
  value,
  onValueChange,
  step = 10,
  minimum = 0,
}: StepperProps) {
  const { colors } = useTokens();

  const adjust = (delta: number) => {
    onValueChange(stepperNext(value, delta, minimum));
  };

  return (
    <View
      accessible
      accessibilityLabel={name}
      accessibilityValue={{ text: `${value} grams` }}
      testID={`stepper:${name}`}
      style={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.decrement"
        onPress={() => adjust(-step)}
        style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border }]}
      >
        <SymbolView name="minus" size={16} weight="semibold" tintColor={colors.text} />
      </Pressable>
      <Text style={[styles.value, { color: colors.text }]}>{`${value} g`}</Text>
      <Pressable
        accessibilityRole="button"
        testID="ccstepper.increment"
        onPress={() => adjust(step)}
        style={[styles.stepButton, { backgroundColor: colors.fill, borderColor: colors.border }]}
      >
        <SymbolView name="plus" size={16} weight="semibold" tintColor={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  value: {
    ...typography.subhead,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'center',
  },
});
