/**
 * CCCard (Components/Cards.swift). Ember card (`#core` frames): `card` fill, `border` hairline,
 * radius `--r-lg` (20). A light-mode-only shadow; the dark scheme is flat.
 */

import { View, type ViewProps } from 'react-native';

import { radius, space, useTokens } from '../tokens';

export type CardProps = ViewProps;

export function Card({ style, ...rest }: CardProps) {
  const { colors, isDark } = useTokens();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: space.lg,
          // The shadow is the text ink on light and never drawn on dark: no color literal.
          shadowColor: colors.text,
          shadowOpacity: isDark ? 0 : 0.04,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
        style,
      ]}
    />
  );
}
