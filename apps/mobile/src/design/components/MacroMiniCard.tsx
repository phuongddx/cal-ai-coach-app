/**
 * CCMacroMiniCard (Components/Cards.swift). Dot + label + rounded gram value
 * over a CCMacroBar. Light mode labels are neutral text (the DS dot rule);
 * dark keeps colored text.
 */

import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typography, useTokens } from '../tokens';

import { MacroBar, macroFillColor, type Macro } from './MacroBar';

export type MacroMiniCardProps = {
  macro: Macro;
  value: number;
  goal: number;
};

export const macroLabels: Record<Macro, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fiber',
};

const round = (n: number) => Math.round(n);

export function MacroMiniCard({ macro, value, goal }: MacroMiniCardProps) {
  const { colors, isDark } = useTokens();
  const label = macroLabels[macro];
  return (
    <View
      testID={`macro-mini:${macro}`}
      accessible
      accessibilityLabel={`${label} ${round(value)} of ${round(goal)} grams`}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[styles.dot, { backgroundColor: macroFillColor(colors, macro) }]}
        />
        <Text
          style={[
            styles.label,
            { color: isDark ? macroFillColor(colors, macro) : colors.text2 },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {`${round(value)}/${round(goal)}g`}
        </Text>
      </View>
      <MacroBar macro={macro} value={value} goal={goal} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.caption,
    flexShrink: 1,
    flexGrow: 1,
  },
  value: {
    ...typography.subhead,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
