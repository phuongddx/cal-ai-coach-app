/**
 * PlanRevealView's local MacroRing — a goal-size ring with the grams inside
 * and the label below. a11y: "Protein 82 grams" (identifier plan.macro.*).
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { size, typography, useTokens } from '../../design';

const RING = size.ringGoal;
const STROKE = size.ringGoalStroke;

export type MacroRingProps = {
  color: string;
  grams: number;
  /** The macro's kcal share (grams × 4/4/9) over the daily target. */
  kcalShare: number;
  totalKcal: number;
  label: string;
  identifier: string;
};

export function MacroRing({ color, grams, kcalShare, totalKcal, label, identifier }: MacroRingProps) {
  const { colors } = useTokens();
  const fraction =
    totalKcal > 0 ? Math.min(Math.max(kcalShare / totalKcal, 0), 1) : 0;
  const radius = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessible
      accessibilityLabel={`${label} ${grams} grams`}
      testID={identifier}
      style={styles.root}
    >
      <View style={[styles.ring, { width: RING, height: RING }]}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={radius} stroke={colors.surface} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={radius}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View pointerEvents="none" style={styles.center}>
          <Text style={[styles.grams, { color: colors.textPrimary }]}>{grams}g</Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    gap: size.ringGoalStroke / 2,
  },
  ring: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grams: {
    ...typography.subhead,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: { ...typography.caption },
});
