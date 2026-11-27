/**
 * CCSheet (Components/Content.swift). The sheet content chrome: grab-handle
 * capsule on the card surface with rounded top corners. Modal presentation
 * itself stays with the feature/route.
 */

import { View, type ViewProps } from 'react-native';

import { radius, space, useTokens, withAlpha } from '../tokens';

export type SheetProps = ViewProps;

export function Sheet({ style, ...rest }: SheetProps) {
  const { colors } = useTokens();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          paddingTop: space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.xl,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: withAlpha('#FFFFFF', 0.2),
          alignSelf: 'flex-start',
          marginBottom: space.md,
        }}
      />
      {rest.children}
    </View>
  );
}
