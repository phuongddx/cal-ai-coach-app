/**
 * OnboardingFlowView.swift — renders the current step of the model's path.
 * The generating step starts the plan generation on appear (`.task` in Swift);
 * with `disableAnimations` the reveal lands instantly. After a successful
 * `persistAndFinish` the flow hands off to the Today tab (`onFinished`).
 */

import { useEffect } from 'react';

import { ActivityDietScreen } from './ActivityDietScreen';
import { BodyMetricsScreen } from './BodyMetricsScreen';
import { GeneratingPlanScreen } from './GeneratingPlanScreen';
import { GoalPickerScreen } from './GoalPickerScreen';
import { GoalWeightPaceScreen } from './GoalWeightPaceScreen';
import { PlanRevealScreen } from './PlanRevealScreen';
import { PrivacyHealthScreen } from './PrivacyHealthScreen';
import { ProjectionScreen } from './ProjectionScreen';
import { ValueHeroScreen } from './ValueHeroScreen';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

export type OnboardingFlowViewProps = {
  model: OnboardingModel;
  /** Navigates to the Today tab with the typed route (the route file binds the router). */
  onFinished: () => void;
};

export function OnboardingFlowView({ model, onFinished }: OnboardingFlowViewProps) {
  useOnboardingModel(model);

  const step = model.currentStep;

  useEffect(() => {
    if (step === 'generating') model.beginGeneration();
  }, [model, step]);

  switch (step) {
    case 'goal':
      return <GoalPickerScreen model={model} />;
    case 'bodyMetrics':
      return <BodyMetricsScreen model={model} />;
    case 'goalWeightPace':
      return <GoalWeightPaceScreen model={model} />;
    case 'activityDiet':
      return <ActivityDietScreen model={model} />;
    case 'projection':
      return <ProjectionScreen model={model} />;
    case 'privacyHealth':
      return <PrivacyHealthScreen model={model} />;
    case 'generating':
      return <GeneratingPlanScreen model={model} />;
    case 'planReveal':
      return <PlanRevealScreen model={model} onFinished={onFinished} />;
    case 'valueHero':
    default:
      return <ValueHeroScreen model={model} />;
  }
}
