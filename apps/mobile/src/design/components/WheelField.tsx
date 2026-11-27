/**
 * CCWheelField (Components/Controls.swift). Label + value line over a wheel
 * picker. RN has no built-in wheel picker in this worktree's dependency set,
 * so the wheel is a snap-scrolling ScrollView with the selected row centered —
 * the closest native-RN equivalent of `pickerStyle(.wheel)`.
 */

import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

export const WHEEL_ROW_HEIGHT = 36;

export type WheelFieldProps<T extends string | number> = {
  label: string;
  items: T[];
  selection: T;
  onSelectionChange: (item: T) => void;
  displayText: (item: T) => string;
};

export function WheelField<T extends string | number>({
  label,
  items,
  selection,
  onSelectionChange,
  displayText,
}: WheelFieldProps<T>) {
  const { colors } = useTokens();
  const index = Math.max(items.indexOf(selection), 0);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const picked = Math.round(offset / WHEEL_ROW_HEIGHT);
    const clamped = Math.min(Math.max(picked, 0), items.length - 1);
    const item = items[clamped];
    if (item != null && item !== selection) {
      onSelectionChange(item);
    }
  };

  return (
    <View
      testID={`wheel-field:${label}`}
      accessible={false}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.accentInk }]} testID={`wheel-value:${label}`}>
        {displayText(selection)}
      </Text>
      <ScrollView
        testID={`wheel-scroll:${label}`}
        style={styles.wheel}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {items.map((item, itemIndex) => (
          <View key={String(item)} style={styles.row}>
            <Text
              style={[
                styles.rowText,
                { color: itemIndex === index ? colors.text : colors.text3 },
              ]}
            >
              {displayText(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  label: {
    ...typography.headline,
  },
  value: {
    ...typography.headline,
    marginTop: space.xs,
  },
  wheel: {
    flexGrow: 0,
    height: WHEEL_ROW_HEIGHT * 3,
    marginTop: space.xs,
  },
  wheelContent: {
    paddingVertical: WHEEL_ROW_HEIGHT,
  },
  row: {
    height: WHEEL_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    ...typography.body,
  },
});
