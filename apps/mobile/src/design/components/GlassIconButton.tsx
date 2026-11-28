/**
 * Round glass icon button of the Ember canvas (`.glassbtn`: 44 pt `--tap`, circle). Two tones:
 *  - `onSurface` (default): the glass the canvas draws on a surface: `card` at 78% in light, 10% of
 *    `text` in dark, with the `border` hairline and a `text` glyph.
 *  - `overMedia`: the glass over a photo or the camera: `mediaScrim` fill, `onMedia` glyph (round 3 tokens,
 *    the same in every mode, High Contrast included).
 *
 * `disabled` dims the glyph (`glassDisabledGlyphAlpha`), ignores presses and reports `accessibilityState.disabled`.
 * The glass itself (native or translucent fill) is not dimmed: a disabled button keeps its disc and only the
 * glyph goes quiet, on every system.
 *
 * Glass (decision D14, U-72): on iOS 26, where `isLiquidGlassAvailable()` is true, the button draws a
 * native `GlassView` (`expo-glass-effect`, as `features/ember/EmberView.tsx` does) behind the glyph.
 * Everywhere else (iOS 18, Android, Jest) the glass is the translucent fill of findings U-71b; the
 * canvas's `backdrop-filter: blur(20px)` is not drawn there.
 */

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { size as sizes, useTokens, withAlpha, type Colors } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type GlassTone = 'overMedia' | 'onSurface';

export type GlassIconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  /** Optional spoken value (the flip button says which camera is in use). */
  accessibilityValueText?: string;
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

/** Liquid Glass shipped with iOS 26; older systems keep the translucent fill (D14). */
export const nativeGlassMinIos = 26;

/**
 * The native glass is only asked for on iOS 26 and later, and only when the native module says it is
 * there; a missing native module counts as "no".
 */
export function hasNativeGlass(): boolean {
  if (Platform.OS !== 'ios' || !(Number.parseInt(String(Platform.Version), 10) >= nativeGlassMinIos)) return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export function GlassIconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityValueText,
  testID,
  tone = 'onSurface',
  diameter = sizes.tap,
  disabled = false,
}: GlassIconButtonProps) {
  const { colors, isDark } = useTokens();
  const glass = glassIconButtonColors(colors, isDark, tone);
  const edge = Math.max(diameter, sizes.tap);
  const nativeGlass = hasNativeGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValueText === undefined ? undefined : { text: accessibilityValueText }}
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
          // With the native glass the fill and the hairline belong to the glass, not to this view.
          backgroundColor: nativeGlass ? 'transparent' : glass.background,
          borderColor: nativeGlass ? 'transparent' : glass.border,
          overflow: 'hidden',
          opacity: pressed && !disabled ? 0.7 : 1,
        },
      ]}
    >
      {nativeGlass && (
        <GlassView
          testID={testID === undefined ? undefined : `${testID}:glass`}
          glassEffectStyle="regular"
          colorScheme={tone === 'overMedia' ? 'dark' : isDark ? 'dark' : 'light'}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      )}
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
