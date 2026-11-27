/**
 * CCSettingsGroup (Components/Cards.swift). Card surface that stacks rows with
 * no gap (the rows carry their own separators in feature compositions).
 */

import { View, type ViewProps } from 'react-native';

import { radius, useTokens } from '../tokens';

export type SettingsGroupProps = ViewProps;

export function SettingsGroup({ style, ...rest }: SettingsGroupProps) {
  const { colors } = useTokens();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    />
  );
}
