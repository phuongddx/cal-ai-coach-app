/**
 * CCMacroBar (Components/Progress.swift). One capsule per macro; track is
 * the `fill` token (Ember `.bar`, `#core`), fill width clamps to the goal and never drops below the
 * bar height. Accessibility-hidden like the Swift bar (the mini card reads it).
 */

import { View } from 'react-native';

import { size, useTokens, type Colors } from '../tokens';

export type Macro = 'protein' | 'carbs' | 'fat' | 'fiber';

export type MacroBarProps = {
  macro: Macro;
  value: number;
  goal: number;
};

export function macroFillColor(colors: Colors, macro: Macro): string {
  switch (macro) {
    case 'protein':
      return colors.protein;
    case 'carbs':
      return colors.carbs;
    case 'fat':
      return colors.fat;
    case 'fiber':
      return colors.fiber;
  }
}

/** `fillWidth(in:)` — fraction of goal, clamped to [0, 1]; 0 without a goal. */
export function macroFillFraction(value: number, goal: number): number {
  return goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0;
}

export function MacroBar({ macro, value, goal }: MacroBarProps) {
  const { colors } = useTokens();
  const track = colors.fill;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: size.macroBarHeight,
        borderRadius: size.macroBarHeight / 2,
        backgroundColor: track,
        overflow: 'hidden',
      }}
    >
      <View
        testID={`macro-bar-fill:${macro}`}
        style={{
          height: size.macroBarHeight,
          width: `${macroFillFraction(value, goal) * 100}%`,
          minWidth: size.macroBarHeight,
          borderRadius: size.macroBarHeight / 2,
          backgroundColor: macroFillColor(colors, macro),
        }}
      />
    </View>
  );
}
