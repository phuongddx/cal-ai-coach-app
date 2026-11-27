/**
 * The one-time-code field of the sign-in frames 112 to 115: six cells in two groups of three, with
 * the digits at 28/600 in `text` ink on `fill` boxes (48 x 58, radius `md`).
 *
 * Underneath the cells is ONE hidden `TextInput` (number pad, `textContentType="oneTimeCode"`,
 * `autoComplete="one-time-code"`), so the keyboard's suggestion and a paste fill all six cells at once
 * and VoiceOver reads a single field named "6-digit code". The cells are drawing only: they are not
 * accessibility elements. `onChangeText` receives digits only, six at most ("482 917" gives "482917").
 *
 * While the input is focused the next empty cell (the last cell once the code is complete) takes a 2 pt
 * `accent` border and, when empty, the caret (frame 112). `error` turns all six borders to `error`
 * (frames 114 and 115 measure #E5243B, the `error` token), whatever the focus.
 *
 * testIDs: `<testID>` (the input), `<testID>.cells`, `<testID>.group.0|1`, `<testID>.cell.0..5`,
 * `<testID>.digit.0..5` and `<testID>.caret`.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, space, textStyles, useTokens } from '../tokens';

/** Length of the code the sign-in e-mail carries. */
export const codeLength = 6;

/** What the field keeps from typed or pasted text: digits only, at most `codeLength`. */
export function codeFieldDigits(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, codeLength);
}

export type CodeFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  testID: string;
  /** What VoiceOver says for the whole field. Default "6-digit code". */
  accessibilityLabel?: string;
  /** Turns the six borders to the `error` color. */
  error?: boolean;
};

const groups = [[0, 1, 2], [3, 4, 5]] as const;

export function CodeField({
  value,
  onChangeText,
  testID,
  accessibilityLabel = '6-digit code',
  error = false,
}: CodeFieldProps) {
  const { colors } = useTokens();
  const [focused, setFocused] = useState(false);
  const digits = codeFieldDigits(value);
  const activeCell = Math.min(digits.length, codeLength - 1);
  const showCaret = focused && digits.length < codeLength;
  return (
    <View style={styles.wrapper}>
      <View
        testID={`${testID}.cells`}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.cells}
      >
        {groups.map((group, groupIndex) => (
          <View key={groupIndex} testID={`${testID}.group.${groupIndex}`} style={styles.group}>
            {group.map((index) => {
              const borderColor = error ? colors.error : focused && index === activeCell ? colors.accent : 'transparent';
              return (
                <View
                  key={index}
                  testID={`${testID}.cell.${index}`}
                  style={[styles.cell, { backgroundColor: colors.fill, borderColor }]}
                >
                  {digits[index] !== undefined && (
                    <Text testID={`${testID}.digit.${index}`} style={[styles.digit, { color: colors.text }]}>
                      {digits[index]}
                    </Text>
                  )}
                  {showCaret && index === digits.length && (
                    <View testID={`${testID}.caret`} style={[styles.caret, { backgroundColor: colors.accent }]} />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={digits}
        onChangeText={(text) => onChangeText(codeFieldDigits(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCorrect={false}
        caretHidden
        style={styles.hiddenInput}
      />
    </View>
  );
}

const cellWidth = 48;
const cellHeight = 58;

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
  },
  group: {
    flexDirection: 'row',
    gap: space.sm,
  },
  cell: {
    width: cellWidth,
    height: cellHeight,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: textStyles.title1.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  caret: {
    width: 2,
    height: textStyles.title1.fontSize,
    borderRadius: 1,
  },
  // Covers the cells so a tap anywhere focuses it; invisible, but still the only field VoiceOver sees.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
