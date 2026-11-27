/**
 * CCPrimaryButton + CCPrimaryButtonStyle, in Ember (design-system.md "Component mapping",
 * canvas `.btn.primary`): `accent` fill, `onAccent` label (never white: 6.89:1), 56 pt high,
 * radius 18, full width. Pressed uses `accentPressed`; disabled is the canvas
 * `.btn.primary.disabled` (`fill` with a `text2` label). The Swift press animation is
 * approximated by the Pressable state; `.sensoryFeedback(.impact)` is a follow-up (no haptics
 * package in this unit, see findings/U-71.md).
 */

import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, size, typography, useTokens, type Colors } from '../tokens';

export type PrimaryButtonProps = {
  title: string;
  action?: () => void;
  disabled?: boolean;
  /** Reaches the Pressable so tests and feature code can address the button. */
  testID?: string;
};

/** The primary button's visual mapping, exposed for contract tests. */
export function primaryButtonStyle(
  colors: Colors,
  pressed: boolean,
  enabled: boolean,
): StyleProp<ViewStyle> {
  return {
    backgroundColor: !enabled ? colors.fill : pressed ? colors.accentPressed : colors.accent,
    borderRadius: radius.button,
    minHeight: size.btn,
    opacity: 1,
    transform: [{ scale: pressed && enabled ? 0.96 : 1 }],
  };
}

/** The label color: `onAccent` on the fill, `text2` on the disabled fill. */
export function primaryButtonLabelColor(colors: Colors, enabled: boolean): string {
  return enabled ? colors.onAccent : colors.text2;
}

export function PrimaryButton({ title, action, disabled = false, testID }: PrimaryButtonProps) {
  const { colors } = useTokens();
  const labelStyle: TextStyle = {
    ...typography.headline,
    color: primaryButtonLabelColor(colors, !disabled),
  };
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => [styles.button, primaryButtonStyle(colors, pressed, !disabled)]}
    >
      <Text style={[labelStyle, styles.label]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    width: '100%',
  },
});
