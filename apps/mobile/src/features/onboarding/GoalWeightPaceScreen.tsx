/**
 * GoalWeightPaceView.swift — the typed goal-weight field and the pace segment
 * (U-73 stage A2: the design system's FillField and Segment replace the wheel
 * and the slider). The segment's options are the owner's decision — Relaxed
 * 0.25, Steady 0.50 (the default, today's default pace) and Faster 1.00 kg a
 * week — and every selection funnels through `model.setPace`, so the stored
 * value is always the engine's clamped result. The card prints the pace the
 * engine returns, and a clamp shows the verbatim safety-floor banner on the
 * caution tokens, as today. The segment's selection follows the raw request
 * (`model.requestedPaceRaw`), which can differ from the clamped stored value.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { TargetsEngine } from '@coachcal/core';

import {
  FillField,
  ScaledNumber,
  Segment,
  markdownSegments,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

const PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed', kgPerWeek: 0.25 },
  { value: 'steady', label: 'Steady', kgPerWeek: 0.5 },
  { value: 'faster', label: 'Faster', kgPerWeek: 1.0 },
] as const;

type PaceOptionValue = (typeof PACE_OPTIONS)[number]['value'];

export function GoalWeightPaceScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const showsPace = model.draft.goal === 'lose' || model.draft.goal === 'gain';
  const [goalWeightText, setGoalWeightText] = useState(() =>
    String(Math.round(model.draft.goalWeightKg ?? model.draft.weightKg)),
  );

  const goalWeightKg = Math.round(model.draft.goalWeightKg ?? model.draft.weightKg);
  // The pace the engine returns for the draft as it stands (0.45 for the
  // default draft — the decision: the card and the readout print it).
  const enginePace = TargetsEngine.targets(model.draft).paceKgPerWeek;
  const paceText = enginePace.toFixed(2);

  // The segment shows the option nearest the raw request (the stored pace can
  // be the clamped result, which matches no option).
  const paceOption: PaceOptionValue = nearestPaceOption(model.requestedPaceRaw ?? 0.5);

  const goalWeightChange = (text: string): void => {
    setGoalWeightText(text);
    const parsed = Number.parseFloat(text);
    if (Number.isFinite(parsed) && parsed > 0) model.setGoalWeightKg(parsed);
  };

  return (
    <StepScaffold
      title="Your target"
      subtitle="We recommend gradual, sustainable progress"
      progress={model.progress}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <View style={styles.heroBlock}>
          <Text style={[styles.headline, { color: colors.text }]}>Goal weight</Text>
          <View
            accessible
            accessibilityLabel={`Goal weight ${goalWeightKg} kilograms`}
            testID="onboarding.goalWeightHero"
            style={styles.heroRow}
          >
            <ScaledNumber text={`${goalWeightKg}`} role="hero" style={{ color: colors.accentInk }} />
            <Text style={[styles.unit, { color: colors.text2 }]}>kg</Text>
          </View>
        </View>
        <FillField
          label="Goal weight"
          value={goalWeightText}
          onChangeText={goalWeightChange}
          unit="kg"
          keyboardType="decimal-pad"
          testID="onboarding.goalWeightField"
        />
        {showsPace && (
          <View style={styles.paceSection}>
            <View style={styles.paceHeader}>
              {/* OB-01 locks the step-4 header: "Weekly pace" (the review's
                  should-fix A put the owner's copy back). */}
              <Text style={[styles.headline, { color: colors.text }]}>Weekly pace</Text>
              <Text
                testID="onboarding.paceValue"
                style={[styles.paceValue, { color: colors.accentInk }]}
              >
                {paceText} kg/wk
              </Text>
            </View>
            <Segment<PaceOptionValue>
              options={PACE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              value={paceOption}
              onChange={(option) => {
                const picked = PACE_OPTIONS.find((entry) => entry.value === option);
                if (picked) model.setPace(picked.kgPerWeek);
              }}
              variant="text"
              accessibilityLabel="Pace"
              testID="onboarding.paceSegment"
            />
            {/* The frame's plain-words card: the pace the engine returned. */}
            <View style={[styles.paceCard, { backgroundColor: colors.grouped }]}>
              <Text style={[styles.paceCardText, { color: colors.text }]}>
                <Text style={styles.paceCardBold}>About {paceText} kg a week.</Text> Most people can
                keep this pace without feeling hungry all the time.
              </Text>
            </View>
            {model.paceClamped && (
              <View
                testID="onboarding.safetyFloor"
                style={[
                  styles.cautionBanner,
                  { backgroundColor: colors.cautionTint, borderColor: colors.caution },
                ]}
              >
                <SymbolView name="info.circle" size={16} tintColor={colors.cautionInk} />
                <Text style={[styles.cautionText, { color: colors.cautionInk }]}>
                  {markdownSegments(onboardingCopy.safetyFloorBanner).map((segment, index) => (
                    <Text key={index} style={segment.bold ? styles.cautionBold : undefined}>
                      {segment.text}
                    </Text>
                  ))}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </StepScaffold>
  );
}

/** The segment option nearest the raw requested pace (0.25 / 0.5 / 1.0). */
function nearestPaceOption(raw: number): PaceOptionValue {
  let best: PaceOptionValue = 'steady';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const option of PACE_OPTIONS) {
    const distance = Math.abs(option.kgPerWeek - raw);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option.value;
    }
  }
  return best;
}

const styles = StyleSheet.create({
  rows: { gap: space.xl2 },
  heroBlock: { gap: space.xs },
  headline: { ...typography.headline },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  unit: { ...typography.subhead },
  paceSection: { gap: space.sm },
  paceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paceValue: { ...typography.headline, fontVariant: ['tabular-nums'] },
  paceCard: {
    borderRadius: radius.md,
    padding: space.md,
  },
  paceCardText: { ...typography.footnote },
  paceCardBold: { fontWeight: '700' },
  cautionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  cautionText: { ...typography.footnote, flex: 1 },
  cautionBold: { fontWeight: '700' },
});
