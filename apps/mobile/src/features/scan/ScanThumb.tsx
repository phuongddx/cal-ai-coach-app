/**
 * The capture thumbnail used by Analyzing and Review: the captured still when there is one, an Ember
 * glyph otherwise. Built here because the design system has no image tile (named in findings/U-30.md).
 */
import { Image, View, type ViewStyle } from 'react-native';

import { darkColors, Icon, radius, useTokens, withAlpha } from '../../design';
import type { ThumbSource } from './scanTypes';

export type ScanThumbProps = {
  thumb: ThumbSource | null;
  size: number;
  cornerRadius?: number;
  /** The tile fill: accent tint on Review, a light veil on the black Analyzing surface. */
  tone: 'review' | 'analyzing';
  testID?: string;
};

export function ScanThumb({ thumb, size, cornerRadius = radius.md, tone, testID }: ScanThumbProps) {
  const { colors } = useTokens();
  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: cornerRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tone === 'review' ? colors.accentTint : withAlpha(darkColors.text, 0.08),
  };
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" style={frame}>
      {thumb !== null ? (
        <Image source={thumb} resizeMode="cover" style={{ width: size, height: size }} />
      ) : (
        <Icon
          name={tone === 'review' ? 'camera' : 'image'}
          size={tone === 'review' ? 22 : 40}
          color={tone === 'review' ? colors.accentInk : withAlpha(darkColors.text, 0.3)}
          testID="scan.thumb.placeholder"
        />
      )}
    </View>
  );
}
