/**
 * Destructive button (Ember `#billing` cancel / `#profile` delete, canvas `.btn.danger`):
 * `errorTint` fill, `errorInk` label, 56 pt, radius 18. `action` is required: a destructive
 * button that does nothing is a bug, not a style.
 */

import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { radius, size, space, typography, useTokens, type Colors } from '../tokens';

export type DestructiveButtonProps = {
  title: string;
  action: () => void;
  /** Reaches the Pressable so tests and feature code can address the button. */
  testID?: string;
};

/** The destructive button's visual mapping, exposed for contract tests. */
export function destructiveButtonStyle(colors: Colors, pressed: boolean): StyleProp<ViewStyle> {
  return {
    backgroundColor: colors.errorTint,
    borderRadius: radius.button,
    minHeight: size.btn,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: pressed ? 0.7 : 1,
  };
}

export function DestructiveButton({ title, action, testID }: DestructiveButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={action}
      style={({ pressed }) => destructiveButtonStyle(colors, pressed)}
    >
      <Text
        style={{
          ...typography.headline,
          color: colors.errorInk,
          paddingHorizontal: space.xl,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
