/**
 * CCProgressRail (Components/Controls.swift). 4pt capsule rail; the lime fill
 * is the clamped progress, at least 4pt wide.
 */

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../tokens';

export type ProgressRailProps = {
  progress: number;
};

export function clampToUnitInterval(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function progressA11yLabel(progress: number): string {
  return `${Math.round(clampToUnitInterval(progress) * 100)} percent complete`;
}

export function ProgressRail({ progress }: ProgressRailProps) {
  const { colors } = useTokens();
  const fraction = clampToUnitInterval(progress);
  return (
    <View
      accessible
      accessibilityLabel={progressA11yLabel(progress)}
      testID="progress-rail"
      style={[styles.rail, { backgroundColor: colors.fill }]}
    >
      <View
        style={{
          height: 4,
          minWidth: 4,
          width: `${fraction * 100}%`,
          borderRadius: 2,
          backgroundColor: colors.accent,
        }}
        testID="progress-rail:fill"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
