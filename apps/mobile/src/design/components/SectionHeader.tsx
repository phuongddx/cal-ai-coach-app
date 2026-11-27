/**
 * CCSectionHeader (Components/Content.swift). Uppercased caption with the
 * 0.55pt letter spacing.
 */

import { Text } from 'react-native';

import { typography, useTokens } from '../tokens';

export type SectionHeaderProps = {
  title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
  const { colors } = useTokens();
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...typography.caption,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.55,
      }}
    >
      {title}
    </Text>
  );
}
