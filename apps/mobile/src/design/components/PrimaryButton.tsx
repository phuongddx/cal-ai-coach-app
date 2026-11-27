/**
 * CCPrimaryButton + CCPrimaryButtonStyle (Components/Buttons.swift).
 * Lime fill, black label, full width; 0.4 opacity while disabled, 0.96 scale
 * while pressed. The Swift 0.12s ease-out press animation is approximated by
 * the instant Pressable state (see parity-detail/design.md).
 */

import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

export type PrimaryButtonProps = {
  title: string;
  action?: () => void;
  disabled?: boolean;
};

/** The CCPrimaryButtonStyle visual mapping, exposed for contract tests. */
export function primaryButtonStyle(
  accentLime: string,
  pressed: boolean,
  enabled: boolean,
): StyleProp<ViewStyle> {
  return {
    backgroundColor: accentLime,
    borderRadius: radius.lg,
    opacity: enabled ? 1 : 0.4,
    transform: [{ scale: pressed && enabled ? 0.96 : 1 }],
  };
}

const labelTypography: TextStyle = {
  ...typography.headline,
  color: '#000000',
};

export function PrimaryButton({ title, action, disabled = false }: PrimaryButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={({ pressed }) => primaryButtonStyle(colors.accentLime, pressed, !disabled)}
    >
      <Text style={[labelTypography, styles.label]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    paddingVertical: space.lg,
    textAlign: 'center',
    width: '100%',
  },
});
