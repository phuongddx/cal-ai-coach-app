/**
 * CCSecondaryButton + CCSecondaryButtonStyle, in Ember (canvas `.btn.secondary`): `fill`
 * background, `text` label, 56 pt, radius 18; the bordered variant adds the 1 pt `border`.
 *
 * `action` is required (design-system.md audit #52: no empty default). A button that must not act yet
 * passes `disabled`: it is dimmed, ignores presses and reports `accessibilityState.disabled`.
 */

import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, typography, useTokens, type Colors } from '../tokens';

export type SecondaryButtonProps = {
  title: string;
  bordered?: boolean;
  action: () => void;
  /** Dims the button, ignores presses and sets `accessibilityState.disabled`. */
  disabled?: boolean;
  /** Reaches the Pressable so tests and feature code can address the button. */
  testID?: string;
};

/** Opacity of a disabled button. */
export const secondaryDisabledOpacity = 0.4;

/** The secondary button's visual mapping, exposed for contract tests. */
export function secondaryButtonStyle(
  bordered: boolean,
  colors: Colors,
  pressed: boolean,
  disabled = false,
): StyleProp<ViewStyle> {
  return {
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: bordered ? colors.border : 'transparent',
    borderRadius: radius.button,
    minHeight: size.btn,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? secondaryDisabledOpacity : pressed ? 0.7 : 1,
  };
}

export function SecondaryButton({
  title,
  bordered = false,
  action,
  disabled = false,
  testID,
}: SecondaryButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={disabled ? undefined : action}
      style={({ pressed }) => secondaryButtonStyle(bordered, colors, pressed, disabled)}
    >
      <Text
        style={{
          ...typography.headline,
          color: colors.text,
          paddingHorizontal: space.xl,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
