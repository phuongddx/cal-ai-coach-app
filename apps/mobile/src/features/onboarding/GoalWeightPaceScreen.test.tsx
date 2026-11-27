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

import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

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
  it('shows the locked copy, the goal weight hero and the typed field identifier', async () => {
    await render(<GoalWeightPaceScreen model={makeModel()} />);

    expect(screen.getByText('Your target')).toBeOnTheScreen();
    expect(screen.getByText('We recommend gradual, sustainable progress')).toBeOnTheScreen();
    // 'Goal weight' is the hero headline and the field label.
    expect(screen.getAllByText('Goal weight')).toHaveLength(2);
    // The hero: draft goal weight 65 kg with the Swift a11y label.
    expect(screen.getByLabelText('Goal weight 65 kilograms')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.goalWeightHero')).toBeOnTheScreen();
    // The typed field holds the draft's value.
    expect(screen.getByTestId('onboarding.goalWeightField')).toHaveDisplayValue('65');
    expect(screen.getByTestId('onboarding.goalWeightField.unit')).toHaveTextContent('kg');
  });

  it('shows the pace segment with the engine pace and the plain-words card', async () => {
    await render(<GoalWeightPaceScreen model={makeModel()} />);

    expect(screen.getByText('Pace')).toBeOnTheScreen();
    // The readout prints the pace the engine returns for the draft (0.45 —
    // the default 0.5 request clamps for this draft).
    expect(screen.getByTestId('onboarding.paceValue')).toBeOnTheScreen();
    expect(screen.getByText('0.45 kg/wk')).toBeOnTheScreen();
    // The three options of the owner's decision, Steady selected by default.
    expect(screen.getByTestId('onboarding.paceSegment')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceSegment.relaxed')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceSegment.steady')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceSegment.faster')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.paceSegment.steady')).toHaveProp('accessibilityState', {
      selected: true,
      checked: true,
    });
    expect(screen.getByTestId('onboarding.paceSegment.faster')).toHaveProp('accessibilityState', {
      selected: false,
      checked: false,
    });
    // The card prints the pace the engine returned.
    expect(screen.getByText(/About 0\.45 kg a week\./)).toBeOnTheScreen();
    expect(screen.getByText(/Most people can keep this pace/)).toBeOnTheScreen();
    // No clamp on the untouched default: no banner.
    expect(screen.queryByTestId('onboarding.safetyFloor')).toBeNull();
  });

  it('the pace segment options store the engine values and keep the picked option', async () => {
    const model = makeModel();
    await render(<GoalWeightPaceScreen model={model} />);

    // Faster (1.0) clamps to the engine's supported pace for this draft.
    await userEvent.press(screen.getByTestId('onboarding.paceSegment.faster'));
    expect(model.draft.requestedPaceKgPerWeek).toBe(0.45);
    expect(model.paceClamped).toBe(true);
    // The segment still shows the option the user picked; the caution banner
    // shows because the engine clamped.
    expect(screen.getByTestId('onboarding.paceSegment.faster')).toHaveProp('accessibilityState', {
      selected: true,
      checked: true,
    });
    expect(screen.getByTestId('onboarding.safetyFloor')).toBeOnTheScreen();

    // Relaxed (0.25) passes through unclamped: the banner goes away.
    await userEvent.press(screen.getByTestId('onboarding.paceSegment.relaxed'));
    expect(model.draft.requestedPaceKgPerWeek).toBe(0.25);
    expect(model.paceClamped).toBe(false);
    expect(screen.queryByTestId('onboarding.safetyFloor')).toBeNull();
  });

  it('a clamped pace shows the verbatim safety-floor banner', async () => {
    const model = makeModel();
    model.setPace(1.5);
    await render(<GoalWeightPaceScreen model={model} />);

    // The value snapped back to the engine's 0.45.
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
    expect(screen.queryByTestId('onboarding.paceSegment')).toBeNull();

    model.selectGoal('habit');
    const habitModel = makeModel();
    habitModel.selectGoal('habit');
    await render(<GoalWeightPaceScreen model={habitModel} />);
    expect(screen.queryByTestId('onboarding.paceSegment')).toBeNull();
    expect(screen.queryByText('Pace')).toBeNull();
  });

  it('the typed goal weight writes through the model and the hero follows', async () => {
    const model = makeModel();
    await render(<GoalWeightPaceScreen model={model} />);

    await fireEvent.changeText(screen.getByTestId('onboarding.goalWeightField'), '72');
    expect(model.draft.goalWeightKg).toBe(72);
    expect(screen.getByLabelText('Goal weight 72 kilograms')).toBeOnTheScreen();
  });
});
