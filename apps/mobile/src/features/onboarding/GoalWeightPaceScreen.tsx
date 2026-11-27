/**
 * GoalWeightPaceView.swift — goal weight hero + wheel, and the weekly pace
 * slider for lose/gain goals. The pace value always lands on the engine's
 * clamped result; a clamp shows the verbatim safety-floor banner on the
 * Ember caution tokens (design-system rule 3: caution is yellow, not orange).
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ScaledNumber, WheelField, markdownSegments, radius, space, typography, useTokens } from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { PaceSlider } from './PaceSlider';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

const GOAL_WEIGHTS: number[] = range(40, 150);

function range(from: number, to: number): number[] {
  const items: number[] = [];
  for (let value = from; value <= to; value += 1) items.push(value);
  return items;
}

export function GoalWeightPaceScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const showsPace = model.draft.goal === 'lose' || model.draft.goal === 'gain';
  const goalWeightKg = Math.round(model.draft.goalWeightKg ?? model.draft.weightKg);
  const paceText = (model.draft.requestedPaceKgPerWeek ?? 0.5).toFixed(2);

  return (
    <StepScaffold
      title="Your target"
      subtitle="We recommend gradual, sustainable progress"
      progress={model.progress}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <View style={styles.heroBlock}>
          <Text style={[styles.headline, { color: colors.textPrimary }]}>Goal weight</Text>
          <View
            accessible
            accessibilityLabel={`Goal weight ${goalWeightKg} kilograms`}
            testID="onboarding.goalWeightHero"
            style={styles.heroRow}
          >
            <ScaledNumber text={`${goalWeightKg}`} role="hero" style={{ color: colors.accentInk }} />
            <Text style={[styles.unit, { color: colors.textSecondary }]}>kg</Text>
          </View>
        </View>
        <View testID="onboarding.goalWeightField">
          <WheelField
            label="Goal weight"
            items={GOAL_WEIGHTS}
            selection={goalWeightKg}
            onSelectionChange={(kg) => model.setGoalWeightKg(kg)}
            displayText={(kg) => `${kg} kg`}
          />
        </View>
        {showsPace && (
          <View style={styles.paceSection}>
            <View style={styles.paceHeader}>
              <Text style={[styles.headline, { color: colors.textPrimary }]}>Weekly pace</Text>
              <Text
                testID="onboarding.paceValue"
                style={[styles.paceValue, { color: colors.accentInk }]}
              >
                {paceText} kg/wk
              </Text>
            </View>
            <PaceSlider
              testID="onboarding.paceSlider"
              value={model.draft.requestedPaceKgPerWeek ?? 0.5}
              onValueChange={(requested) => model.setPace(requested)}
              accessibilityValueText={`${paceText} kilograms per week`}
            />
            {/* The Swift view marks this caption row accessibilityHidden; RNTL queries
                mirror the accessibility tree, so the row stays queryable (see
                parity-detail/onboarding.md — a11y parity gap noted). */}
            <View style={styles.paceLabels}>
              <Text style={[styles.paceLabel, { color: colors.textSecondary }]}>Slow</Text>
              <Text style={[styles.paceLabel, { color: colors.textSecondary }]}>Recommended</Text>
              <Text style={[styles.paceLabel, { color: colors.textSecondary }]}>Fast</Text>
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
  paceLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  paceLabel: { ...typography.caption },
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
