/**
 * CCSheet (Components/Content.swift). The sheet content chrome: a visible, centered drag
 * indicator on the card surface with `--r-xl` corners (Ember `#system` sheet).
 * Modal presentation itself stays with the feature/route.
 *
 * Detents: React Native has no per-sheet detent API on a plain view, so `detent` is an optional
 * prop that caps the sheet's height at the iOS medium (half of the window) or large (almost the
 * full window) detent. A route that presents the sheet natively sets `sheetAllowedDetents`
 * itself (docs/rn-migration/findings/U-71.md).
 */

import { useWindowDimensions, View, type ViewProps } from 'react-native';

import { radius, space, useTokens } from '../tokens';

export type SheetDetent = 'medium' | 'large';

export type SheetProps = ViewProps & {
  /** Optional. Caps the height at the medium or large detent. Off by default. */
  detent?: SheetDetent;
};

/** Fraction of the window height a detent allows: medium is half, large leaves the top gap. */
export const sheetDetentFraction: Record<SheetDetent, number> = {
  medium: 0.5,
  large: 0.92,
};

export function sheetDetentHeight(detent: SheetDetent, windowHeight: number): number {
  return Math.round(windowHeight * sheetDetentFraction[detent]);
}

export const sheetGrabberSize = { width: 36, height: 5 } as const;

export function Sheet({ style, detent, children, ...rest }: SheetProps) {
  const { colors } = useTokens();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.elevated,
          borderRadius: radius.xl,
          paddingTop: space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.xl,
        },
        detent != null ? { maxHeight: sheetDetentHeight(detent, windowHeight) } : null,
        style,
      ]}
    >
      <View
        testID="sheet:grabber"
        style={{
          width: sheetGrabberSize.width,
          height: sheetGrabberSize.height,
          borderRadius: sheetGrabberSize.height / 2,
          backgroundColor: colors.grabber,
          alignSelf: 'center',
          marginBottom: space.md,
        }}
      />
      {children}
    </View>
  );
}
