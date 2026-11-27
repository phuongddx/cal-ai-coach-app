/**
 * CCScaledNumber — hero (700/56) and plan (700/64) numerals from Tokens.swift.
 * The Swift version scales with Dynamic Type via @ScaledMetric(relativeTo: .largeTitle);
 * the RN Text scales with the OS text size while `allowFontScaling` is on (default).
 * `monospacedDigit()` becomes the `tabular-nums` font variant.
 */

import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { scaledNumberSize, type ScaledNumberRole } from '../tokens';

export type ScaledNumberProps = {
  text: string;
  role: ScaledNumberRole;
  style?: StyleProp<TextStyle>;
  /** One line, shrunk to fit its container (SwiftUI minimumScaleFactor) instead of wrapping digits. */
  fitWidth?: boolean;
};

export function ScaledNumber({ text, role, style, fitWidth = false }: ScaledNumberProps) {
  return (
    <Text
      allowFontScaling
      {...(fitWidth ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 } : null)}
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
