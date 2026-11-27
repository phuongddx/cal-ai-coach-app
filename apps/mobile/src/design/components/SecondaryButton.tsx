/**
 * CCSecondaryButton + CCSecondaryButtonStyle (Components/Buttons.swift).
 * Muted label, optional 1pt border; 0.7 opacity while pressed.
 */

import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

export type SecondaryButtonProps = {
  title: string;
  bordered?: boolean;
  action?: () => void;
  /** Reaches the Pressable so tests and feature code can address the button. */
  testID?: string;
};

/** The CCSecondaryButtonStyle visual mapping, exposed for contract tests. */
export function secondaryButtonStyle(
  bordered: boolean,
  borderColor: string,
  pressed: boolean,
): StyleProp<ViewStyle> {
  return {
    borderWidth: 1,
    borderColor: bordered ? borderColor : 'transparent',
    borderRadius: radius.md,
    opacity: pressed ? 0.7 : 1,
  };
}

export function SecondaryButton({ title, bordered = false, action, testID }: SecondaryButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={action}
      style={({ pressed }) =>
        secondaryButtonStyle(bordered, colors.border, pressed)
      }
    >
      <Text
        style={{
          ...typography.subhead,
          fontWeight: '500',
          color: colors.textSecondary,
          paddingVertical: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
