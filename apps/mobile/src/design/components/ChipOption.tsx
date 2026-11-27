/**
 * CCChipOption (Components/Controls.swift). Capsule chip with the selected
 * trait, lime-tinted when selected.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { space, typography, useTokens, withAlpha } from '../tokens';

export type ChipOptionProps = {
  title: string;
  isSelected: boolean;
  onSelect?: () => void;
};

export function ChipOption({ title, isSelected, onSelect }: ChipOptionProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      testID={`chip-option:${title}`}
      onPress={onSelect}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected
            ? withAlpha(colors.accentLime, 0.15)
            : colors.surface,
          borderWidth: 1,
          borderColor: isSelected ? colors.accentLime : 'transparent',
        },
      ]}
    >
      <Text
        style={{
          ...typography.subhead,
          color: isSelected ? colors.accentInk : colors.textSecondary,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
});
