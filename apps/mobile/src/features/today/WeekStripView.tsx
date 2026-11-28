/**
 * WeekStripView — the week strip of the Ember frames (U-76): seven 44 by 56 pt cells with the `md` radius,
 * the weekday initial over a 17 pt rounded day number. The selected cell takes `accentTint` and `accentInk`;
 * the others `text3` and `text`. The row spreads the cells over the width (`space-between`).
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { fontFamily, radius, size, textStyles, useTokens } from '../../design';

import { dayCellLabel, dayNumber, weekdayInitial } from './todayFormat';
import { isSameDay } from './todayModel';

export type WeekStripViewProps = {
  days: Date[];
  selectedDay: Date;
  onSelect: (day: Date) => void;
};

export function WeekStripView({ days, selectedDay, onSelect }: WeekStripViewProps) {
  const { colors } = useTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="today.weekStrip"
      contentContainerStyle={styles.row}
    >
      {days.map((day) => {
        const selected = isSameDay(day, selectedDay);
        return (
          <Pressable
            key={day.toISOString()}
            testID="today.dayCell"
            accessibilityRole="button"
            accessibilityLabel={dayCellLabel(day)}
            accessibilityState={{ selected }}
            onPress={() => onSelect(day)}
            style={[styles.cell, selected && { backgroundColor: colors.accentTint }]}
          >
            <Text style={[styles.initial, { color: selected ? colors.accentInk : colors.text3 }]}>
              {weekdayInitial(day)}
            </Text>
            <Text style={[styles.number, { color: selected ? colors.accentInk : colors.text }]}>
              {dayNumber(day)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow + space-between: seven cells share the width of the screen; a narrow screen scrolls.
  row: { flexGrow: 1, justifyContent: 'space-between' },
  cell: {
    width: size.tap,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  initial: { fontSize: textStyles.caption1.fontSize, fontWeight: '500' },
  number: { fontSize: 17, fontWeight: '600', fontFamily: fontFamily.round, fontVariant: ['tabular-nums'] },
});
