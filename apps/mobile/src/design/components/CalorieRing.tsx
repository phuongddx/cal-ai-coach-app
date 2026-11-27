/**
 * CCCalorieRing (Components/Progress.swift). The calorie ring in hero, compact
 * and goal sizes. ED-safe replaces the consumed fraction with fraction-of-day
 * so the ring carries no kcal meaning. Drawn with react-native-svg: a track
 * circle plus a progress arc rotated -90° with a round cap.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { size, useTokens, withAlpha } from '../tokens';

import { ScaledNumber } from './ScaledNumber';
import { useEdSafeMode } from '../edSafe';

export type RingVariant = 'hero' | 'compact' | 'goal';

export type CalorieRingProps = {
  consumed?: number;
  goal?: number;
  variant?: RingVariant;
  /** Fraction of day elapsed; defaults to the real clock in ED-safe mode. */
  dayProgress?: number;
};

const ringGeometry: Record<RingVariant, { size: number; stroke: number }> = {
  hero: { size: size.ringHero, stroke: size.ringHeroStroke },
  compact: { size: size.ringCompact, stroke: size.ringCompactStroke },
  goal: { size: size.ringGoal, stroke: size.ringGoalStroke },
};

export function defaultDayProgress(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = now.getTime() - start.getTime();
  return elapsed / 86_400_000;
}

/** `dayPercentText` — the ED-safe center label, assertable without rendering. */
export function dayPercentText(dayProgress: number): string {
  return `${Math.round(clampToUnitInterval(dayProgress) * 100)}% of day`;
}

export function clampToUnitInterval(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function calorieRingA11yLabel(
  edSafeMode: boolean,
  consumed: number | undefined,
  goal: number | undefined,
): string {
  if (edSafeMode) return 'On track';
  if (consumed == null || goal == null) return 'Calorie ring';
  const remaining = Math.max(goal - consumed, 0);
  return `${remaining} calories remaining of ${goal} goal`;
}

export function calorieProgressFraction(
  edSafeMode: boolean,
  consumed: number | undefined,
  goal: number | undefined,
  dayProgress: number | undefined,
): number {
  if (edSafeMode) {
    return clampToUnitInterval(dayProgress ?? defaultDayProgress());
  }
  if (consumed == null || goal == null || goal <= 0) return 0;
  return clampToUnitInterval(consumed / goal);
}

export function CalorieRing({
  consumed,
  goal,
  variant = 'hero',
  dayProgress,
}: CalorieRingProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  const dark = colors.background === '#000000';
  const trackColor = dark ? 'rgba(255,255,255,0.1)' : colors.surface;
  const geometry = ringGeometry[variant];
  const radius = (geometry.size - geometry.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = calorieProgressFraction(edSafeMode, consumed, goal, dayProgress);
  const edSafeDayProgress = clampToUnitInterval(dayProgress ?? defaultDayProgress());
  const remaining = consumed != null && goal != null ? Math.max(goal - consumed, 0) : null;

  return (
    <View
      accessible
      accessibilityLabel={calorieRingA11yLabel(edSafeMode, consumed, goal)}
      testID={`calorie-ring:${variant}`}
      style={[styles.ring, { width: geometry.size, height: geometry.size }]}
    >
      <Svg width={geometry.size} height={geometry.size}>
        <Circle
          cx={geometry.size / 2}
          cy={geometry.size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={geometry.stroke}
          fill="none"
        />
        <Circle
          cx={geometry.size / 2}
          cy={geometry.size / 2}
          r={radius}
          stroke={colors.accentLime}
          strokeWidth={geometry.stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
          transform={`rotate(-90 ${geometry.size / 2} ${geometry.size / 2})`}
        />
      </Svg>
      {edSafeMode ? (
        <View style={[styles.center, { paddingHorizontal: geometry.stroke + 8 }]} pointerEvents="none">
          <Text style={[styles.onTrack, { color: colors.textPrimary }]}>On track</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.dayPercent, { color: colors.textSecondary }]}
          >
            {dayPercentText(edSafeDayProgress)}
          </Text>
        </View>
      ) : (
        variant === 'hero' &&
        remaining != null && (
          <View style={[styles.center, { paddingHorizontal: geometry.stroke + 8 }]} pointerEvents="none">
            <ScaledNumber
              text={`${remaining}`}
              role="hero"
              fitWidth
              style={{ color: colors.textPrimary }}
            />
            <Text style={[styles.dayPercent, { color: colors.textSecondary }]}>remaining</Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onTrack: {
    fontSize: 15,
    fontWeight: '400',
  },
  dayPercent: {
    fontSize: 13,
    fontWeight: '400',
  },
});
