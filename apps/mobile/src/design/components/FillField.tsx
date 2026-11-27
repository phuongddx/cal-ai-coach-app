/**
 * The 56 pt fill field of the Ember frames (onboarding "Age 29 years", "Height 172 cm", Goal weight,
 * target edit sheet): a `fill` box (radius `--r-md`) with the value in 700 22 and the unit in
 * 500 15 `text2`. The label (500 13 `text2`) stays above the box and is never only a placeholder.
 *
 * The value is the typed text; the caller parses it. Tapping anywhere on the box focuses the input.
 * testIDs: `<testID>` (the input), `<testID>.label`, `<testID>.unit`.
 */

import { useRef, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { radius, size, space, typography, useTokens } from '../tokens';

/** Width of one 700 22 tabular digit, in points. */
export const fieldDigitWidth = 13;

export type FillFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  accessibilityLabel?: string;
  testID: string;
};

export function FillField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  keyboardType = 'default',
  accessibilityLabel,
  testID,
}: FillFieldProps) {
  const { colors } = useTokens();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const { fontScale } = useWindowDimensions();
  // The canvas sets the unit right after the value, so the input is as wide as its text (a tabular
  // 700 22 digit is about 13 pt wide); an empty field is as wide as its placeholder.
  const characters = Math.max((value.length > 0 ? value : (placeholder ?? '')).length, 1);
  const textWidth = Math.ceil(characters * fieldDigitWidth * Math.min(fontScale, 1.3)) + 4;
  return (
    <View style={styles.column}>
      <Text testID={`${testID}.label`} style={[styles.label, { color: colors.text2 }]}>
        {label}
      </Text>
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        style={[styles.box, { backgroundColor: colors.fill }]}
      >
        <TextInput
          ref={input}
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? (unit != null ? `${label}, ${unit}` : label)}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text3}
          keyboardType={keyboardType}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.text, width: textWidth }]}
        />
        {unit != null && (
          <Text testID={`${testID}.unit`} style={[styles.unit, { color: colors.text2 }]}>
            {unit}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: space.sm - 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  box: {
    height: size.btn,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  input: {
    maxWidth: '80%',
    padding: 0,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    ...typography.subhead,
    fontWeight: '500',
  },
});
