/**
 * CCDashedAddButton (Components/Buttons.swift). Dashed 1pt border, plus icon
 * and a 14pt medium label that scales with Dynamic Type. RN's borderStyle
 * dashed cannot take the Swift 6/4 dash pattern — the dash shape is a native
 * approximation (see parity-detail/design.md).
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, useTokens } from '../tokens';

export type DashedAddButtonProps = {
  title?: string;
  action?: () => void;
};

export function DashedAddButton({ title = 'Add food', action }: DashedAddButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={[
        styles.button,
        { borderColor: colors.border },
      ]}
    >
      <SymbolView name="plus" size={14} tintColor={colors.text2} />
      <Text style={[styles.title, { color: colors.text2 }]} allowFontScaling>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    width: '100%',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
});
