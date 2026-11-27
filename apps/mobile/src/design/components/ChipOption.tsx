/**
 * CCChipOption (Components/Controls.swift). Chip with the selected trait. Ember (`#system`
 * chip): selected = `accent` fill with an `onAccent` label, otherwise a `fill` chip with
 * `text2`; drawn height 36, radius 18. The touch target is 44 pt (`--tap`): hit slop of 4 pt above and below
 * keeps the drawn height, and a one-letter chip is widened to 44.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, size, space, typography, useTokens } from '../tokens';

/** Drawn height of the chip. */
export const chipHeight = 36;

/** Vertical hit slop that brings the 36 pt chip to the 44 pt target. */
export const chipHitSlop = (size.tap - chipHeight) / 2;

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
      hitSlop={{ top: chipHitSlop, bottom: chipHitSlop }}
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
    minHeight: chipHeight,
    minWidth: size.tap,
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
  },
});
