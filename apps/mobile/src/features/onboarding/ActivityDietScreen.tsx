/**
 * ActivityDietView.swift — five activity option cards and the optional diet
 * chips. Card identifiers: onboarding.activityCard.<level>; chip identifiers:
 * onboarding.dietChip.<lowercased style without spaces>.
 */

import { StyleSheet, Text, View } from 'react-native';

import { ChipOption, OptionCard, space, typography, useTokens } from '../../design';

import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { ActivityLevel, OnboardingModel } from './onboardingModel';

const LEVELS: ReadonlyArray<{ level: ActivityLevel; title: string; subtitle: string; icon: string }> = [
  { level: 'sedentary', title: 'Sedentary', subtitle: 'Mostly sitting, little movement', icon: 'figure.seated.side' },
  { level: 'light', title: 'Lightly active', subtitle: 'Light exercise 1–3 days a week', icon: 'figure.walk' },
  { level: 'moderate', title: 'Moderately active', subtitle: 'Exercise 3–5 days a week', icon: 'figure.run' },
  { level: 'active', title: 'Very active', subtitle: 'Hard exercise 6–7 days a week', icon: 'dumbbell' },
  { level: 'athlete', title: 'Athlete', subtitle: 'Training most days, high intensity', icon: 'trophy.fill' },
];

/** Shared with the generating step's formula line (the level's display title). */
export { LEVELS };

const DIET_STYLES = ['Standard', 'High protein', 'Vegetarian', 'Vegan', 'Keto'] as const;

export function ActivityDietScreen({ model }: { model: OnboardingModel }) {
  const snapshot = useOnboardingModel(model);
  const { colors } = useTokens();
  return (
    <StepScaffold
      title="Lifestyle"
      subtitle="Fine-tune your calorie target"
      progress={snapshot.progress}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <Text testID="onboarding.activityHeader" style={[styles.headline, { color: colors.textPrimary }]}>
          Activity level
        </Text>
        <View style={styles.cards}>
          {LEVELS.map((entry) => (
            <View key={entry.level} testID={`onboarding.activityCard.${entry.level}`}>
              <OptionCard
                title={entry.title}
                subtitle={entry.subtitle}
                icon={entry.icon}
                isSelected={snapshot.draft.activityLevel === entry.level}
                onSelect={() => model.selectActivityLevel(entry.level)}
              />
            </View>
          ))}
        </View>
        <Text testID="onboarding.dietHeader" style={[styles.headline, { color: colors.textPrimary }]}>
          Diet style (optional)
        </Text>
        <View style={styles.chips}>
          <View style={styles.chipRow}>
            {DIET_STYLES.slice(0, 3).map((style) => (
              <DietChip key={style} model={model} style={style} selected={snapshot.dietStyle === style} />
            ))}
          </View>
          <View style={styles.chipRow}>
            {DIET_STYLES.slice(3).map((style) => (
              <DietChip key={style} model={model} style={style} selected={snapshot.dietStyle === style} />
            ))}
          </View>
        </View>
      </View>
    </StepScaffold>
  );
}

function DietChip({ model, style, selected }: { model: OnboardingModel; style: string; selected: boolean }) {
  return (
    <View testID={`onboarding.dietChip.${style.toLowerCase().replaceAll(' ', '')}`}>
      <ChipOption
        title={style}
        isSelected={selected}
        onSelect={() => model.selectDietStyle(style)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.lg },
  headline: { ...typography.headline },
  cards: { gap: space.md },
  chips: { gap: space.sm },
  chipRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
