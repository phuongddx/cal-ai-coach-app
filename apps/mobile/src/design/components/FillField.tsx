/**
 * The 56 pt fill field of the Ember frames (onboarding "Age 29 years", "Height 172 cm", Goal weight,
 * target edit sheet): a `fill` box (radius `--r-md`) with the value in 700 22 and the unit in
 * 500 15 `text2`. The label (500 13 `text2`) stays above the box and is never only a placeholder.
 *
 * The value is the typed text; the caller parses it. Tapping anywhere on the box focuses the input.
 * testIDs: `<testID>` (the input), `<testID>.label`, `<testID>.unit`, `<testID>.ring`.
 *
 * `variant="text"` is the sign-in field (frame 108): the value at 17/400 across the whole box, for an
 * e-mail address. The default `number` variant is the numeric field of onboarding, unchanged. While the
 * input is focused a 2 pt `accent` ring is drawn over the box edge; `error` draws the same ring in
 * `error` (frames 110 and 114 measure #E5243B, the `error` token, not `errorInk`, which is the ink of
 * the message text). The ring is an overlay, so it never moves the content.
 */

import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
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
  /** `number` (default): 22/700, as wide as its digits. `text`: 17/400, full width (frame 108). */
  variant?: 'number' | 'text';
  /** Draws the border in the `error` color (frames 110 and 114). */
  error?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: TextInputProps['autoCorrect'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: TextInputProps['maxLength'];
  secureTextEntry?: TextInputProps['secureTextEntry'];
  editable?: TextInputProps['editable'];
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
};

/** Width of the focus ring and of the error border. */
export const fieldRingWidth = 2;

export function FillField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  keyboardType = 'default',
  accessibilityLabel,
  testID,
  variant = 'number',
  error = false,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  textContentType,
  maxLength,
  secureTextEntry,
  editable,
  onFocus,
  onBlur,
}: FillFieldProps) {
  const { colors } = useTokens();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const ringColor = error ? colors.error : focused ? colors.accent : undefined;
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
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          selectionColor={colors.accent}
          style={
            variant === 'text'
              ? [styles.textInput, { color: colors.text }]
              : [styles.input, { color: colors.text, width: textWidth }]
          }
        />
        {unit != null && (
          <Text testID={`${testID}.unit`} style={[styles.unit, { color: colors.text2 }]}>
            {unit}
          </Text>
        )}
        {ringColor !== undefined && (
          <View
            testID={`${testID}.ring`}
            pointerEvents="none"
            style={[styles.ring, { borderColor: ringColor }]}
          />
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
  textInput: {
    flex: 1,
    padding: 0,
    fontSize: 17,
    fontWeight: '400',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: fieldRingWidth,
    borderRadius: radius.md,
  },
  unit: {
    ...typography.subhead,
    fontWeight: '500',
  },
});
