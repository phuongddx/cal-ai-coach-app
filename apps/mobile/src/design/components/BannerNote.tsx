/**
 * CCBannerNote (Components/Cards.swift). Footnote banner in three variants.
 * The `markdown` prop is the Swift `init(markdown:)` form: locked-banner copy
 * leads with a bold **markdown** clause, which this renderer inlines without
 * printing the asterisks.
 */

import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typography, useTokens, withAlpha, type Colors } from '../tokens';

export type BannerVariant = 'success' | 'neutral' | 'info';

export type BannerNoteProps = {
  text: string;
  variant?: BannerVariant;
  markdown?: boolean;
};

function bannerBackground(colors: Colors, variant: BannerVariant): string {
  switch (variant) {
    case 'success':
      return withAlpha(colors.success, 0.1);
    case 'neutral':
      return 'rgba(255,255,255,0.04)';
    case 'info':
      return withAlpha(colors.info, 0.1);
  }
}

function bannerBorder(colors: Colors, variant: BannerVariant): string {
  switch (variant) {
    case 'success':
      return withAlpha(colors.success, 0.2);
    case 'neutral':
      return colors.border;
    case 'info':
      return withAlpha(colors.info, 0.2);
  }
}

/** Splits a `**bold**`-prefixed markdown run into styled segments. */
export function markdownSegments(text: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = [];
  const parts = text.split('**');
  parts.forEach((part, index) => {
    if (part.length > 0) segments.push({ text: part, bold: index % 2 === 1 });
  });
  return segments;
}

export function BannerNote({ text, variant = 'neutral', markdown = false }: BannerNoteProps) {
  const { colors } = useTokens();
  return (
    <View
      testID={`banner:${variant}`}
      accessibilityRole="text"
      style={[
        styles.banner,
        {
          backgroundColor: bannerBackground(colors, variant),
          borderColor: bannerBorder(colors, variant),
        },
      ]}
    >
      {markdown ? (
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          {markdownSegments(text).map((segment, index) => (
            <Text
              key={index}
              style={segment.bold ? styles.bold : undefined}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ) : (
        <Text style={[styles.text, { color: colors.textPrimary }]}>{text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
  },
  text: {
    ...typography.footnote,
  },
  bold: {
    fontWeight: '700',
  },
});
