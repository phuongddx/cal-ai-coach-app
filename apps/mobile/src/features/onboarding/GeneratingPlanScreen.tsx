/**
 * GeneratingPlanView.swift — 120pt indeterminate→% ring + 4-step checklist;
 * `disableAnimations` flips the steps instantly (the model skips the minimum
 * window entirely). `beginGeneration` runs on appear, like the Swift `.task`.
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { ProgressRail, size, space, typography, useTokens, withAlpha } from '../../design';

import { GENERATION_STEPS } from './onboardingCopy';
import { useOnboardingModel } from './useOnboardingModel';
import type { GenerationStepState, OnboardingModel } from './onboardingModel';

const STROKE = size.ringCompactStroke;
const RING_SIZE = size.ringCompact;

export function GeneratingPlanScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const dark = colors.background === '#000000';
  const trackColor = dark ? 'rgba(255,255,255,0.1)' : colors.surface;

  useEffect(() => {
    model.beginGeneration();
  }, [model]);

  const percent = model.generationPercent;
  const percentText = percent === null ? '…' : `${percent}%`;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const trim = percent === null ? 0.25 : Math.min(Math.max(percent / 100, 0), 1);

  return (
    <View
      testID="onboarding.generating"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.rail}>
        <ProgressRail progress={model.progress} />
      </View>
      <View style={styles.content}>
        <View
          accessible
          accessibilityLabel={`Generating your plan, ${percentText}`}
          style={[styles.ring, { width: RING_SIZE, height: RING_SIZE }]}
        >
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={trackColor}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Indeterminate stub while percent is null (hidden from a11y, as in Swift). */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={colors.accentLime}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * trim} ${circumference}`}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View pointerEvents="none" style={styles.ringCenter}>
            <Text
              testID="onboarding.generatingPercent"
              style={[styles.percent, { color: colors.accentInk }]}
            >
              {percentText}
            </Text>
          </View>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Creating your plan</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Personalizing based on your goals
          </Text>
        </View>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {GENERATION_STEPS.map((step, index) => (
            <StepRow
              key={step}
              index={index}
              step={step}
              state={model.generationStates[index] ?? 'idle'}
              colors={colors}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function StepRow({
  index,
  step,
  state,
  colors,
}: {
  index: number;
  step: string;
  state: GenerationStepState;
  colors: ReturnType<typeof useTokens>['colors'];
}) {
  const stateLabel = state === 'done' ? 'done' : state === 'active' ? 'in progress' : 'waiting';
  return (
    <View
      accessible
      accessibilityLabel={`${step}, ${stateLabel}`}
      testID={`onboarding.genStep.${index}`}
      style={styles.stepRow}
    >
      <StepIcon state={state} colors={colors} />
      <Text
        style={[
          styles.stepText,
          state === 'idle'
            ? { color: colors.textSecondary, fontWeight: '400' }
            : { color: colors.textPrimary, fontWeight: '500' },
        ]}
      >
        {step}
      </Text>
    </View>
  );
}

function StepIcon({
  state,
  colors,
}: {
  state: GenerationStepState;
  colors: ReturnType<typeof useTokens>['colors'];
}) {
  if (state === 'done') {
    return <SymbolView name="checkmark.circle.fill" size={18} tintColor={colors.successInk} />;
  }
  if (state === 'active') {
    return <ActivityIndicator style={styles.icon} color={colors.accentInk} />;
  }
  return (
    <View
      style={[
        styles.icon,
        styles.idleIcon,
        { borderColor: withAlpha(colors.textTertiary, 0.4) },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rail: { paddingHorizontal: space.lg, paddingTop: space.xs },
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
  percent: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepText: { ...typography.subhead },
  icon: { width: 18, height: 18 },
  idleIcon: {
    borderRadius: 9,
    borderWidth: 1.5,
  },
});
