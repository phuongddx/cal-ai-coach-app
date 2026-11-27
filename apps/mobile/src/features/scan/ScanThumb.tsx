/**
 * The capture thumbnail used by Analyzing and Review: the captured still when there is one, a glyph
 * otherwise. Built here because the design system has no image tile (named in findings/U-30.md).
 */
import { Image, View, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, useTokens, withAlpha } from '../../design';
import type { ThumbSource } from './scanTypes';

export type ScanThumbProps = {
  thumb: ThumbSource | null;
  size: number;
  cornerRadius?: number;
  /** The tile fill: lime tint on Review, white veil on the black Analyzing surface. */
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
    backgroundColor: tone === 'review' ? withAlpha(colors.accentLime, 0.15) : 'rgba(255,255,255,0.08)',
  };
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" style={frame}>
      {thumb !== null ? (
        <Image source={thumb} resizeMode="cover" style={{ width: size, height: size }} />
      ) : (
        <SymbolView
          name={tone === 'review' ? 'camera' : 'photo'}
          size={tone === 'review' ? 22 : 40}
          tintColor={tone === 'review' ? colors.accentInk : 'rgba(255,255,255,0.3)'}
        />
      )}
    </View>
  );
}
