/**
 * Segment of the Ember canvas: a single-choice row. Two variants:
 *  - `chips`: the mode row of the viewfinder (`#scan` frame 01). The selected chip is black on orange
 *    (`onAccent` on `accent`, 6.89:1), the others are the dark chip `rgba(42,39,36,.85)` with
 *    `emberText`: dark glass over the camera in both schemes (36 pt chips inside 44 pt targets).
 *  - `text`: the canvas `.seg` (meal segment of Review, Search / Saved / Recent, Week / Month / 3M /
 *    Year, kg / lb): a `fill` track with a raised pill under the selected option, whose label is in
 *    `accentInk`. The pill is `card` in light; in dark it is `text` at 12%, which approximates the canvas dark
 *    pill (a warm grey with no token of its own) without a literal.
 *
 * Every option is a radio button (role `radio`, `selected` and `checked` state, so VoiceOver says
 * "selected") with a target of 44 pt and the testID `<testID>.<value>`. The row is a radio group.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { darkColors, radius, size, space, typography, useTokens, withAlpha } from '../tokens';

export type SegmentOption<T extends string = string> = {
  value: T;
  label: string;
};

export type SegmentProps<T extends string = string> = {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  variant: 'chips' | 'text';
  accessibilityLabel: string;
  testID: string;
};

/** Height of the visible chip / pill inside the 44 pt target. */
export const segmentChipHeight = 36;
export const segmentPillHeight = 34;

export function Segment<T extends string = string>({
  options,
  value,
  onChange,
  variant,
  accessibilityLabel,
  testID,
}: SegmentProps<T>) {
  const { colors, isDark } = useTokens();
  const chips = variant === 'chips';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={chips ? styles.chipRow : [styles.track, { backgroundColor: colors.fill }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const pillColor = isDark ? withAlpha(colors.text, 0.12) : colors.card;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            testID={`${testID}.${option.value}`}
            onPress={() => onChange(option.value)}
            style={chips ? styles.chipTarget : styles.textTarget}
          >
            {chips ? (
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.accent : withAlpha(darkColors.elevated, 0.85),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? colors.onAccent : colors.emberText },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.pill,
                  selected && {
                    backgroundColor: pillColor,
                    shadowColor: colors.ember,
                    shadowOpacity: isDark ? 0 : 0.12,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.pillLabel, { color: selected ? colors.accentInk : colors.text }]}
                >
                  {option.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  chipTarget: {
    minHeight: size.tap,
    minWidth: size.tap,
    justifyContent: 'center',
  },
  chip: {
    minHeight: segmentChipHeight,
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: space.lg - 2,
  },
  chipLabel: {
    ...typography.subhead,
    fontWeight: '600',
  },
  track: {
    flexDirection: 'row',
    minHeight: size.tap,
    borderRadius: 12,
    paddingHorizontal: 3,
    gap: 2,
  },
  textTarget: {
    flex: 1,
    minHeight: size.tap,
    justifyContent: 'center',
  },
  pill: {
    height: segmentPillHeight,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
