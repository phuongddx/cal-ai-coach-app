/**
 * BodyMetricsView.swift — sex chips, height / weight / DOB wheels, the
 * under-18 gate. The gate footnote is locked copy (onboardingCopy) and the
 * Continue CTA disables while it blocks.
 */

import { StyleSheet, Text, View } from 'react-native';

import { ChipOption, WheelField, space, typography, useTokens } from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

const HEIGHTS: number[] = range(120, 220);
const WEIGHTS: number[] = range(35, 200);

function range(from: number, to: number): number[] {
  const items: number[] = [];
  for (let value = from; value <= to; value += 1) items.push(value);
  return items;
}

export function BodyMetricsScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  return (
    <StepScaffold
      title="About you"
      subtitle="Used to calculate your targets"
      progress={model.progress}
      ctaEnabled={!model.isDobGateBlocked}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <View style={styles.sexRow}>
          <View testID="onboarding.sexFemale">
            <ChipOption
              title="Female"
              isSelected={model.draft.sex === 'female'}
              onSelect={() => model.selectSex('female')}
            />
          </View>
          <View testID="onboarding.sexMale">
            <ChipOption
              title="Male"
              isSelected={model.draft.sex === 'male'}
              onSelect={() => model.selectSex('male')}
            />
          </View>
        </View>
        <View testID="onboarding.heightField">
          <WheelField
            label="Height"
            items={HEIGHTS}
            selection={Math.round(model.draft.heightCm)}
            onSelectionChange={(cm) => model.setHeightCm(cm)}
            displayText={(cm) => `${cm} cm`}
          />
        </View>
        <View testID="onboarding.weightField">
          <WheelField
            label="Current weight"
            items={WEIGHTS}
            selection={Math.round(model.draft.weightKg)}
            onSelectionChange={(kg) => model.setWeightKg(kg)}
            displayText={(kg) => `${kg} kg`}
          />
        </View>
        <View testID="onboarding.dobField">
          <WheelField
            label="Date of birth"
            items={model.dobYears}
            selection={model.birthYear}
            onSelectionChange={(year) => model.setBirthYear(year)}
            displayText={(year) => String(year)}
          />
        </View>
        {model.isDobGateBlocked && (
          <Text testID="onboarding.dobGate" style={[styles.footnote, { color: colors.errorInk }]}>
            {onboardingCopy.dobGateFootnote}
          </Text>
        )}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.lg },
  sexRow: { flexDirection: 'row', gap: space.sm },
  footnote: { ...typography.footnote },
});
