/**
 * Round glass icon button of the Ember canvas (`.glassbtn`: 44 pt `--tap`, circle). Two tones:
 *  - `onSurface` (default): the glass the canvas draws on a surface: `card` at 78% in light, 10% of
 *    `text` in dark, with the `border` hairline and a `text` glyph.
 *  - `overMedia`: the dark glass over a photo or the camera (black at 45%, light glyph).
 *
 * There is no blur package, so the glass is a translucent fill (findings U-71b); the canvas's
 * `backdrop-filter: blur(20px)` is not drawn.
 */

import { Pressable, StyleSheet } from 'react-native';

import { darkColors, size as sizes, useTokens, withAlpha, type Colors } from '../tokens';

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
};

/** Surface, hairline and glyph of a tone. Exposed for the contract test. */
export function glassIconButtonColors(
  colors: Colors,
  isDark: boolean,
  tone: GlassTone,
): { background: string; border: string; glyph: string } {
  if (tone === 'overMedia') {
    // Over media the glass is dark in both schemes: `darkColors.bg` is the black, `emberText` the light glyph.
    return {
      background: withAlpha(darkColors.bg, 0.45),
      border: 'transparent',
      glyph: colors.emberText,
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
}: GlassIconButtonProps) {
  const { colors, isDark } = useTokens();
  const glass = glassIconButtonColors(colors, isDark, tone);
  const edge = Math.max(diameter, sizes.tap);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: edge,
          height: edge,
          borderRadius: edge / 2,
          backgroundColor: glass.background,
          borderColor: glass.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size={22} color={glass.glyph} />
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
