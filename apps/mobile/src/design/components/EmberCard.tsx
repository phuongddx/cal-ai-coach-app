/**
 * Ember hero card (Ember `#core` Today hero, `#scan` result, `#glance` widget): the signature
 * dark card, `ember` in both schemes, with the orange glow (`accent` at 30%) in a corner,
 * radius `--r-xl` (28) and 20 pt padding. Text on it uses `emberText` / `emberText2` /
 * `emberAccent` (`CalorieRing onEmber`).
 *
 * The glow is a react-native-svg radial gradient; CSS `radial-gradient` has no RN equivalent.
 */

import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { radius, space, useTokens } from '../tokens';

export type EmberCardProps = ViewProps & {
  /** Optional. Draw the orange glow. On by default. */
  glow?: boolean;
};

/** Opacity of the glow's center stop (design-system.md: orange glow at 30%). */
export const emberGlowOpacity = 0.3;

export function EmberCard({ style, glow = true, children, ...rest }: EmberCardProps) {
  const { colors } = useTokens();
  return (
    <View
      testID="ember-card"
      {...rest}
      style={[
        {
          backgroundColor: colors.ember,
          borderRadius: radius.xl,
          padding: space.xl,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {glow && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" testID="ember-card:glow">
          <Defs>
            <RadialGradient id="cc-ember-glow" cx="85%" cy="0%" rx="70%" ry="70%" fx="85%" fy="0%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={emberGlowOpacity} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cc-ember-glow)" />
        </Svg>
      )}
      {children}
    </View>
  );
}
