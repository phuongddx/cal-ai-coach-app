/**
 * CCSecondaryButton + CCSecondaryButtonStyle, in Ember (canvas `.btn.secondary`): `fill`
 * background, `text` label, 56 pt, radius 18; the bordered variant adds the 1 pt `border`.
 *
 * `action` stays optional in the type because `features/profile/SettingsDetailView.tsx` still
 * renders two buttons without one and `features/**` is outside this unit. design-system.md asks
 * for the empty default to go (audit #52): a button without `action` is exposed as disabled
 * instead of looking pressable and doing nothing, and the profile restyle unit makes the prop
 * required once it passes one (findings/U-71.md, open question).
 */

import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, typography, useTokens, type Colors } from '../tokens';

export type SecondaryButtonProps = {
  title: string;
  bordered?: boolean;
  action?: () => void;
  /** Reaches the Pressable so tests and feature code can address the button. */
  testID?: string;
};

/** The secondary button's visual mapping, exposed for contract tests. */
export function secondaryButtonStyle(
  bordered: boolean,
  colors: Colors,
  pressed: boolean,
): StyleProp<ViewStyle> {
  return {
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: bordered ? colors.border : 'transparent',
    borderRadius: radius.button,
    minHeight: size.btn,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: pressed ? 0.7 : 1,
  };
}

export function SecondaryButton({ title, bordered = false, action, testID }: SecondaryButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={action == null ? { disabled: true } : undefined}
      testID={testID}
      onPress={action}
      style={({ pressed }) => secondaryButtonStyle(bordered, colors, pressed)}
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
