/**
 * GoalPickerView.swift — four single-select option cards; the selection lives
 * in the onboarding model's draft. Card identifiers: onboarding.goalCard.<goal>.
 */

import { StyleSheet, View } from 'react-native';

import { OptionCard, space } from '../../design';

import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { Goal, OnboardingModel } from './onboardingModel';

const OPTIONS: ReadonlyArray<{ goal: Goal; title: string; subtitle: string; icon: string }> = [
  { goal: 'lose', title: 'Lose weight', subtitle: 'Sustainable calorie deficit', icon: 'flame' },
  { goal: 'maintain', title: 'Maintain weight', subtitle: 'Stay at your current weight', icon: 'equal.circle' },
  { goal: 'gain', title: 'Gain weight', subtitle: 'Healthy calorie surplus', icon: 'arrow.up.circle' },
  { goal: 'habit', title: 'Build a habit', subtitle: 'Just track, no calorie goal', icon: 'checkmark.seal' },
];

export function GoalPickerScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  return (
    <StepScaffold
      title="What's your goal?"
      subtitle="We'll personalize your plan"
      progress={model.progress}
      action={() => model.advance()}
    >
      <View style={styles.cards}>
        {OPTIONS.map((option) => (
          <View key={option.goal} testID={`onboarding.goalCard.${option.goal}`}>
            <OptionCard
              title={option.title}
              subtitle={option.subtitle}
              icon={option.icon}
              isSelected={model.draft.goal === option.goal}
              onSelect={() => model.selectGoal(option.goal)}
            />
          </View>
        ))}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.md },
});
