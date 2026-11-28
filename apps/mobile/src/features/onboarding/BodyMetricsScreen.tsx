/**
 * BodyMetricsView.swift — sex chips, the typed height / weight fields, the
 * DOB wheel and the under-18 gate. U-73 stage A2 swaps the height and weight
 * wheels for the design system's FillField (the frame's typed 56 pt fields);
 * the DOB wheel stays with the gate (behavior + identifiers the brief keeps).
 * The gate footnote is locked copy (onboardingCopy) and the Continue CTA
 * disables while it blocks. A field writes through the model as soon as its
 * text parses to a positive number, so the draft always holds the last typed
 * value; the text stays exactly what the user typed. On blur the parsed text
 * clamps through the model to the old wheel's range (the owner decision) and
 * the field then shows the clamped value; typing never clamps.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChipOption, FillField, WheelField, space, typography, useTokens } from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

export function BodyMetricsScreen({ model }: { model: OnboardingModel }) {
  const snapshot = useOnboardingModel(model);
  const { colors } = useTokens();
  const [heightText, setHeightText] = useState(() => String(Math.round(snapshot.draft.heightCm)));
  const [weightText, setWeightText] = useState(() => String(Math.round(snapshot.draft.weightKg)));

  // The typed text is the field's state; the model receives every value that
  // parses, so the draft never holds a stale number when the flow continues.
  const heightChange = (text: string): void => {
    setHeightText(text);
    const parsed = Number.parseFloat(text);
    if (Number.isFinite(parsed) && parsed > 0) model.setHeightCm(parsed);
  };
  const weightChange = (text: string): void => {
    setWeightText(text);
    const parsed = Number.parseFloat(text);
    if (Number.isFinite(parsed) && parsed > 0) model.setWeightKg(parsed);
  };
  // The blur clamp (the owner decision): the parsed text clamps through the
  // model to the old wheel's range; typing never clamps and an empty or
  // unusable field writes nothing. The field then shows the clamped value.
  const heightBlur = (): void => {
    const parsed = Number.parseFloat(heightText);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const clamped = model.clampHeightCm(parsed);
    if (clamped !== parsed) setHeightText(String(clamped));
  };
  const weightBlur = (): void => {
    const parsed = Number.parseFloat(weightText);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const clamped = model.clampWeightKg(parsed);
    if (clamped !== parsed) setWeightText(String(clamped));
  };

  return (
    <StepScaffold
      title="About you"
      subtitle="Used to calculate your targets"
      progress={snapshot.progress}
      ctaEnabled={!snapshot.isDobGateBlocked}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <View style={styles.sexRow}>
          <View testID="onboarding.sexFemale">
            <ChipOption
              title="Female"
              isSelected={snapshot.draft.sex === 'female'}
              onSelect={() => model.selectSex('female')}
            />
          </View>
          <View testID="onboarding.sexMale">
            <ChipOption
              title="Male"
              isSelected={snapshot.draft.sex === 'male'}
              onSelect={() => model.selectSex('male')}
            />
          </View>
        </View>
        <FillField
          label="Height"
          value={heightText}
          onChangeText={heightChange}
          onBlur={heightBlur}
          unit="cm"
          keyboardType="decimal-pad"
          testID="onboarding.heightField"
        />
        <FillField
          label="Current weight"
          value={weightText}
          onChangeText={weightChange}
          onBlur={weightBlur}
          unit="kg"
          keyboardType="decimal-pad"
          testID="onboarding.weightField"
        />
        <View testID="onboarding.dobField">
          <WheelField
            label="Date of birth"
            items={snapshot.dobYears as number[]}
            selection={snapshot.birthYear}
            onSelectionChange={(year) => model.setBirthYear(year)}
            displayText={(year) => String(year)}
          />
        </View>
        {snapshot.isDobGateBlocked && (
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
