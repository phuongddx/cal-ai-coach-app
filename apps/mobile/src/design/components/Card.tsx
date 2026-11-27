/**
 * CCCard (Components/Cards.swift). Card surface with light-mode-only shadow.
 */

import { View, type ViewProps } from 'react-native';

import { radius, space, useTokens } from '../tokens';

export type CardProps = ViewProps;

export function Card({ style, ...rest }: CardProps) {
  const { colors } = useTokens();
  const dark = colors.background === '#000000';
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
          shadowColor: '#000000',
          shadowOpacity: dark ? 0 : 0.04,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
        style,
      ]}
    />
  );
}
