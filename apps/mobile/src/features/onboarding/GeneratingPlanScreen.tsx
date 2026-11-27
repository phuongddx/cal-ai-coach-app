/**
 * GeneratingPlanView.swift — the Ember frame's honest step: the indeterminate
 * ring over the locked title, and the formula lines the engine just computed —
 * Mifflin-St Jeor resting energy, the activity multiplier, the pace
 * adjustment, the floored daily target. No percent readout and no minimum
 * window (both were numbers the app invented): the engine computes
 * synchronously and the flow lands the reveal at once. The card collapses
 * under ED-safe mode through the design system's EdSafeCollapse (invariant
 * I7); the frame's ED-safe-only "Balancing your meals" line waits for the
 * design system's note component (findings U-73, batch-2 swap).
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { ACTIVITY_MULTIPLIER, TargetsEngine } from '@coachcal/core';

import { EdSafeCollapse, ProgressRail, size, space, typography, useTokens } from '../../design';

import { LEVELS } from './ActivityDietScreen';
import { grouped } from './format';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

const STROKE = size.ringCompactStroke;
const RING_SIZE = size.ringCompact;

export function GeneratingPlanScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();

  useEffect(() => {
    model.beginGeneration();
  }, [model]);

  // The formula is the engine's own math over the draft — the same calls the
  // model's generation makes (ProjectionScreen reads the engine the same way).
  const bmr = TargetsEngine.bmr(model.draft);
  const tdee = TargetsEngine.tdee(bmr, model.draft.activityLevel);
  const targets = TargetsEngine.targets(model.draft);
  const activityTitle =
    LEVELS.find((entry) => entry.level === model.draft.activityLevel)?.title ?? model.draft.activityLevel;
  const factor = ACTIVITY_MULTIPLIER[model.draft.activityLevel];
  // The pace line exists only where the quiz carries a pace (lose/gain); the
  // label names the engine's clamped pace, the value the plan's real delta.
  const pace = targets.paceKgPerWeek;
  const showsPace = model.draft.requestedPaceKgPerWeek !== null;
  const paceSign = model.draft.goal === 'gain' ? '+' : '−';
  const paceDelta = Math.abs(tdee - targets.dailyKcal);

  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  // The frame's working ring stays indeterminate: a fixed stub arc, no percent.
  const trim = 0.25;

  return (
    <View
      testID="onboarding.generating"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.rail}>
        <Text style={[styles.stepCaption, { color: colors.text2 }]}>Step 8 of 9</Text>
        <ProgressRail progress={model.progress} />
      </View>
      <View style={styles.content}>
        <View
          accessible
          accessibilityLabel="Generating your plan"
          style={[styles.ring, { width: RING_SIZE, height: RING_SIZE }]}
        >
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={colors.fill}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Indeterminate stub arc (hidden from a11y, as in Swift). */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={colors.accentStrong}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * trim} ${circumference}`}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View pointerEvents="none" style={styles.ringCenter}>
            <SymbolView name="sparkles" size={22} tintColor={colors.text} />
          </View>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>Creating your plan</Text>
          <Text style={[styles.subtitle, { color: colors.text2 }]}>Personalizing based on your goals</Text>
        </View>
        {/* The numbers are kcal framing: the design component owns the branch. */}
        <EdSafeCollapse>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FormulaRow label="Resting energy (Mifflin-St Jeor)" value={grouped(bmr)} />
            <FormulaRow label={`× ${activityTitle} ${factor}`} value={grouped(tdee)} />
            {showsPace && (
              <FormulaRow
                label={`${paceSign} Pace ${pace.toFixed(2)} kg/week`}
                value={`${paceSign}${grouped(paceDelta)}`}
              />
            )}
            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
            <FormulaRow label="Daily target" value={`${grouped(targets.dailyKcal)} kcal`} accent />
          </View>
        </EdSafeCollapse>
      </View>
    </View>
  );
}

function FormulaRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTokens();
  return (
    <View style={styles.formulaRow}>
      <Text style={[styles.formulaLabel, { color: colors.text2 }]}>{label}</Text>
      <Text
        style={[
          styles.formulaValue,
          accent ? { color: colors.accentInk } : { color: colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rail: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  stepCaption: {
    ...typography.footnote,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    gap: space.xl2,
    paddingHorizontal: space.lg,
    paddingTop: space.xl4,
  },
  ring: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { gap: space.xs },
  title: { ...typography.title },
  subtitle: { ...typography.subhead },
  card: {
    alignSelf: 'stretch',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderRadius: 16,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  formulaLabel: { ...typography.footnote, flex: 1 },
  formulaValue: {
    ...typography.footnote,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  separator: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
