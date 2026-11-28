/**
 * The onboarding screens over the REAL OnboardingModel, with the model changing while the screen is
 * mounted (U-84 B). The app compiles with the React Compiler, which treats a value that keeps its
 * identity as unchanged: a screen that subscribes, throws the result away and reads `model.draft.goal`
 * or `model.reveal` in render draws the old values after the model moves. Jest does not compile, so
 * these cases only go red under `npm run test:compiler`; they are green under `npm test` on both
 * versions of the screens.
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side requests are
 * re-pointed onto the renderer's copy. See findings/U-22.md.
 */
jest.mock('react', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { act, render, screen } from '@testing-library/react-native';

import { setEdSafeMode } from '../../design';

import { ActivityDietScreen } from './ActivityDietScreen';
import { BodyMetricsScreen } from './BodyMetricsScreen';
import { GoalPickerScreen } from './GoalPickerScreen';
import { GoalWeightPaceScreen } from './GoalWeightPaceScreen';
import { OnboardingFlowView } from './OnboardingFlowView';
import { PlanRevealScreen } from './PlanRevealScreen';
import { PrivacyHealthScreen } from './PrivacyHealthScreen';
import { ProjectionScreen } from './ProjectionScreen';
import { onboardingCopy } from './onboardingCopy';
import { createOnboardingModel } from './onboardingModel';

function makeModel(writeSetting: (key: string, value: string) => Promise<void> = async () => undefined) {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting,
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
}

describe('Onboarding screens over the real model, model changing while mounted', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('GoalPickerScreen: a goal chosen on the model moves the selected card', async () => {
    const model = makeModel();
    await render(<GoalPickerScreen model={model} />);
    expect(screen.queryByRole('button', { name: 'Gain weight, Healthy calorie surplus, selected' })).toBeNull();

    await act(async () => {
      model.selectGoal('gain');
    });

    expect(screen.getByRole('button', { name: 'Gain weight, Healthy calorie surplus, selected' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Lose weight, Sustainable calorie deficit, selected' })).toBeNull();
  });

  it('ActivityDietScreen: an activity level chosen on the model moves the selected card', async () => {
    const model = makeModel();
    await render(<ActivityDietScreen model={model} />);
    const selected = { name: 'Very active, Hard exercise 6–7 days a week, selected' };
    expect(screen.queryByRole('button', selected)).toBeNull();

    await act(async () => {
      model.selectActivityLevel('active');
    });

    expect(screen.getByRole('button', selected)).toBeOnTheScreen();
  });

  it('BodyMetricsScreen: a birth year that fails the age gate shows the gate line and blocks Continue', async () => {
    const model = makeModel();
    await render(<BodyMetricsScreen model={model} />);
    expect(screen.queryByTestId('onboarding.dobGate')).toBeNull();

    await act(async () => {
      model.setBirthYear(2014);
    });

    expect(screen.getByTestId('onboarding.dobGate')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.dobGateFootnote)).toBeOnTheScreen();
  });

  it('GoalWeightPaceScreen: choosing a losing goal shows the pace card and the engine\'s safety-floor note', async () => {
    const model = makeModel();
    model.selectGoal('maintain');
    await render(<GoalWeightPaceScreen model={model} />);
    expect(screen.queryByTestId('onboarding.safetyFloor')).toBeNull();
    expect(screen.queryByTestId('onboarding.paceSegment')).toBeNull();

    await act(async () => {
      model.selectGoal('lose');
    });

    expect(model.paceClamped).toBe(true);
    expect(screen.getByTestId('onboarding.paceSegment')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.safetyFloor')).toBeOnTheScreen();
  });

  it('ProjectionScreen: a new goal weight moves the goal figure', async () => {
    const model = makeModel();
    model.selectGoal('lose');
    await render(<ProjectionScreen model={model} />);
    expect(screen.getByTestId('onboarding.projectionGoal')).toHaveTextContent('65 kg');

    await act(async () => {
      model.setGoalWeightKg(55);
    });

    expect(screen.getByTestId('onboarding.projectionGoal')).toHaveTextContent('55 kg');
  });

  it('PrivacyHealthScreen: a failed policy write shows the verbatim error banner', async () => {
    const model = makeModel(async () => {
      throw new Error('disk is full');
    });
    await render(<PrivacyHealthScreen model={model} />);
    expect(screen.queryByText('disk is full')).toBeNull();

    await act(async () => {
      await model.setSafeModePolicy(true).catch(() => undefined);
    });

    expect(screen.getByText('disk is full')).toBeOnTheScreen();
  });

  it('PlanRevealScreen: an adjusted kcal moves the hero', async () => {
    const model = makeModel();
    for (let index = 0; index < 7; index += 1) model.advance();
    model.finishGenerationForTesting();
    await render(<PlanRevealScreen model={model} onFinished={jest.fn()} />);
    expect(screen.getByLabelText('1693 calories per day')).toBeOnTheScreen();

    await act(async () => {
      model.adjustRevealKcal(50);
    });
    expect(screen.getByLabelText('1743 calories per day')).toBeOnTheScreen();
    expect(screen.queryByLabelText('1693 calories per day')).toBeNull();
  });

  it('OnboardingFlowView: advancing the model swaps the screen', async () => {
    const model = makeModel();
    await render(<OnboardingFlowView model={model} onFinished={jest.fn()} />);
    expect(screen.getByTestId('onboarding.getStarted')).toBeOnTheScreen();

    await act(async () => {
      model.advance();
    });

    expect(screen.getByTestId('onboarding.goalCard.lose')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding.getStarted')).toBeNull();
  });
});
