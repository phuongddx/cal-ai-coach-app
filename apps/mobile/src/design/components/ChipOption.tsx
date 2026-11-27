/**
 * CCChipOption (Components/Controls.swift). Chip with the selected trait. Ember (`#system`
 * chip): selected = `accent` fill with an `onAccent` label, otherwise a `fill` chip with
 * `text2`; height 36, radius 18.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

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
      style={[styles.chip, { backgroundColor: isSelected ? colors.accent : colors.fill }]}
    >
      <Text
        style={{
          ...typography.subhead,
          fontWeight: isSelected ? '600' : typography.subhead.fontWeight,
          color: isSelected ? colors.onAccent : colors.text2,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
  },
});
