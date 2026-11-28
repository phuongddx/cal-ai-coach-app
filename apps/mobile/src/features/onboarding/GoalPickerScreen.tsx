/**
 * GoalPickerView.swift — four single-select option cards; the selection lives
 * in the onboarding model's draft. Card identifiers: onboarding.goalCard.<goal>.
 */

import { StyleSheet, View } from 'react-native';

import { OptionCard, type IconName, space } from '../../design';

import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { Goal, OnboardingModel } from './onboardingModel';

const OPTIONS: ReadonlyArray<{ goal: Goal; title: string; subtitle: string; icon: IconName }> = [
  { goal: 'lose', title: 'Lose weight', subtitle: 'Sustainable calorie deficit', icon: 'chart' },
  { goal: 'maintain', title: 'Maintain weight', subtitle: 'Stay at your current weight', icon: 'target' },
  { goal: 'gain', title: 'Gain weight', subtitle: 'Healthy calorie surplus', icon: 'dumbbell' },
  { goal: 'habit', title: 'Build a habit', subtitle: 'Just track, no calorie goal', icon: 'leaf' },
];

export function GoalPickerScreen({ model }: { model: OnboardingModel }) {
  const snapshot = useOnboardingModel(model);
  return (
    <StepScaffold
      title="What's your goal?"
      subtitle="We'll personalize your plan"
      progress={snapshot.progress}
      action={() => model.advance()}
    >
      <View style={styles.cards}>
        {OPTIONS.map((option) => (
          <View key={option.goal} testID={`onboarding.goalCard.${option.goal}`}>
            {/* The frame's Ember glyph in the icon tile (U-71b's iconName). */}
            <OptionCard
              title={option.title}
              subtitle={option.subtitle}
              iconName={option.icon}
              isSelected={snapshot.draft.goal === option.goal}
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
