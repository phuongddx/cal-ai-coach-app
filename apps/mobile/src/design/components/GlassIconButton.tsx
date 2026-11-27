/**
 * Round glass icon button of the Ember canvas (`.glassbtn`: 44 pt `--tap`, circle). Two tones:
 *  - `onSurface` (default): the glass the canvas draws on a surface: `card` at 78% in light, 10% of
 *    `text` in dark, with the `border` hairline and a `text` glyph.
 *  - `overMedia`: the glass over a photo or the camera: `mediaScrim` fill, `onMedia` glyph (round 3 tokens,
 *    the same in every mode, High Contrast included).
 *
 * `disabled` dims the glyph, ignores presses and reports `accessibilityState.disabled`.
 *
 * There is no blur package, so the glass is a translucent fill (findings U-71b); the canvas's
 * `backdrop-filter: blur(20px)` is not drawn.
 */

import { Pressable, StyleSheet } from 'react-native';

import { size as sizes, useTokens, withAlpha, type Colors } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type GlassTone = 'overMedia' | 'onSurface';

export type GlassIconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  tone?: GlassTone;
  /** Diameter in points; never below 44 (`--tap`). The viewfinder's library button is 52. */
  diameter?: number;
  /** Dims the glyph, ignores presses and sets `accessibilityState.disabled`. */
  disabled?: boolean;
};

/** Opacity of the glyph while the button is disabled. */
export const glassDisabledGlyphAlpha = 0.4;

/** Surface, hairline and glyph of a tone. Exposed for the contract test. */
export function glassIconButtonColors(
  colors: Colors,
  isDark: boolean,
  tone: GlassTone,
): { background: string; border: string; glyph: string } {
  if (tone === 'overMedia') {
    // Over media the backdrop is the photo, not the theme: the scrim and the glyph do not change with mode.
    return {
      background: colors.mediaScrim,
      border: 'transparent',
      glyph: colors.onMedia,
    };
  }
  return {
    background: isDark ? withAlpha(colors.text, 0.1) : withAlpha(colors.card, 0.78),
    border: colors.border,
    glyph: colors.text,
  };
}

export function GlassIconButton({
  icon,
  onPress,
  accessibilityLabel,
  testID,
  tone = 'onSurface',
  diameter = sizes.tap,
  disabled = false,
}: GlassIconButtonProps) {
  const { colors, isDark } = useTokens();
  const glass = glassIconButtonColors(colors, isDark, tone);
  const edge = Math.max(diameter, sizes.tap);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: edge,
          height: edge,
          borderRadius: edge / 2,
          backgroundColor: glass.background,
          borderColor: glass.border,
          opacity: pressed && !disabled ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        name={icon}
        size={22}
        color={disabled ? withAlpha(glass.glyph, glassDisabledGlyphAlpha) : glass.glyph}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
