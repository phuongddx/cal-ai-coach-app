/**
 * WeekStripView.swift — the horizontal week strip: seven 40pt day cells (weekday initial over a
 * semibold day number); the selected cell has the lime background, radius 12 and black text. The
 * colors are the SwiftUI ones (selected: black / black at 70%; others: tertiary / secondary text).
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { radius, space, typography, useTokens } from '../../design';

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
            style={[styles.cell, selected && { backgroundColor: colors.accentLime }]}
          >
            <Text
              style={[
                typography.caption,
                { color: selected ? 'rgba(0,0,0,0.7)' : colors.textTertiary },
              ]}
            >
              {weekdayInitial(day)}
            </Text>
            <Text
              style={[
                styles.number,
                { color: selected ? '#000000' : colors.textSecondary },
              ]}
            >
              {dayNumber(day)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.xs },
  cell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  number: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
