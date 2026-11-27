/**
 * CCScaledNumber — hero (700/56) and plan (700/64) numerals from Tokens.swift.
 * The Swift version scales with Dynamic Type via @ScaledMetric(relativeTo: .largeTitle);
 * the RN Text scales with the OS text size while `allowFontScaling` is on (default).
 * `monospacedDigit()` becomes the `tabular-nums` font variant.
 *
 * `fitWidth` (U-71, Ember `#core` ring): keeps the number on one line and shrinks it to
 * the width its parent gives it (`numberOfLines={1}`, `adjustsFontSizeToFit`, floor 50%),
 * so a four-digit remaining value never wraps inside the 184 pt hero ring.
 */

import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { scaledNumberSize, type ScaledNumberRole } from '../tokens';

export type ScaledNumberProps = {
  text: string;
  role: ScaledNumberRole;
  style?: StyleProp<TextStyle>;
  /** Optional. One line, shrink to fit the parent's width. Off by default. */
  fitWidth?: boolean;
};

/** Smallest scale `fitWidth` may shrink to. */
export const fitWidthMinimumFontScale = 0.5;

export function ScaledNumber({ text, role, style, fitWidth = false }: ScaledNumberProps) {
  return (
    <Text
      allowFontScaling
      {...(fitWidth
        ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: fitWidthMinimumFontScale }
        : {})}
      style={[styles.number, { fontSize: scaledNumberSize[role] }, style]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  number: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
