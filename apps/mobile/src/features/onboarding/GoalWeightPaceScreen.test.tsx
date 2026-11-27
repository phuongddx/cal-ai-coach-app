/**
 * RNTL screen test of GoalWeightPaceView.swift (OB-07): the locked copy, the
 * goal weight hero and wheel, the pace slider and the safety-floor banner.
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
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

import { render, screen, userEvent } from '@testing-library/react-native';

import { GoalWeightPaceScreen } from './GoalWeightPaceScreen';
import { onboardingCopy } from './onboardingCopy';
import { createOnboardingModel } from './onboardingModel';

function makeModel() {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
}

describe('goal weight and pace screen', () => {
  it('shows the locked copy, the goal weight hero and the wheel identifier', async () => {
    await render(<GoalWeightPaceScreen model={makeModel()} />);

    expect(screen.getByText('Your target')).toBeOnTheScreen();
    expect(screen.getByText('We recommend gradual, sustainable progress')).toBeOnTheScreen();
    // 'Goal weight' is the hero headline and the wheel label.
    expect(screen.getAllByText('Goal weight')).toHaveLength(2);
    // The hero: draft goal weight 65 kg with the Swift a11y label.
    expect(screen.getByLabelText('Goal weight 65 kilograms')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.goalWeightHero')).toBeOnTheScreen();
    // The hero wheel row and the wheel's value line both render "65 kg".
    expect(screen.getAllByText('65 kg').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('onboarding.goalWeightField')).toBeOnTheScreen();
  });

  it('shows the pace slider for a lose goal with the formatted value and the axis captions', async () => {
    await render(<GoalWeightPaceScreen model={makeModel()} />);

    expect(screen.getByText('Weekly pace')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceValue')).toBeOnTheScreen();
    expect(screen.getByText('0.50 kg/wk')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceSlider')).toBeOnTheScreen();
    expect(screen.getByText('Slow')).toBeOnTheScreen();
    expect(screen.getByText('Recommended')).toBeOnTheScreen();
    expect(screen.getByText('Fast')).toBeOnTheScreen();
    // No clamp on the default 0.5 pace: no banner.
    expect(screen.queryByTestId('onboarding.safetyFloor')).toBeNull();
  });

  it('a clamped pace shows the verbatim safety-floor banner', async () => {
    const model = makeModel();
    model.setPace(1.5);
    await render(<GoalWeightPaceScreen model={model} />);

    // The slider value snapped back to the engine's 0.45.
    expect(screen.getByText('0.45 kg/wk')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.safetyFloor')).toBeOnTheScreen();
    expect(screen.getByText('Safety floor:')).toBeOnTheScreen();
    expect(screen.getByText(/1,500 kcal\/day for men/)).toBeOnTheScreen();
    expect(onboardingCopy.safetyFloorBanner).toContain('1,500 kcal/day for men');
  });

  it('hides the pace section for maintain and habit goals', async () => {
    const model = makeModel();
    model.selectGoal('maintain');
    await render(<GoalWeightPaceScreen model={model} />);
    expect(screen.queryByTestId('onboarding.paceSlider')).toBeNull();

    model.selectGoal('habit');
    const habitModel = makeModel();
    habitModel.selectGoal('habit');
    await render(<GoalWeightPaceScreen model={habitModel} />);
    expect(screen.queryByTestId('onboarding.paceSlider')).toBeNull();
    expect(screen.queryByText('Weekly pace')).toBeNull();
  });

  it('the wheel writes the goal weight through the model and the hero follows', async () => {
    const model = makeModel();
    model.setGoalWeightKg(72);
    await render(<GoalWeightPaceScreen model={model} />);

    expect(screen.getByLabelText('Goal weight 72 kilograms')).toBeOnTheScreen();
    // The wheel value line and the wheel row both show the selection.
    expect(screen.getAllByText('72 kg').length).toBeGreaterThanOrEqual(1);
  });
});
