/**
 * RNTL screen test of GoalPickerView.swift (OB-04): the locked copy, the four
 * goal card identifiers and the single-select state.
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

import { GoalPickerScreen } from './GoalPickerScreen';
import { createOnboardingModel } from './onboardingModel';

function makeModel() {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    disableAnimations: true,
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
}

describe('goal picker screen', () => {
  it('shows the locked copy and all four goal card identifiers', async () => {
    await render(<GoalPickerScreen model={makeModel()} />);

    expect(screen.getByText("What's your goal?")).toBeOnTheScreen();
    expect(screen.getByText("We'll personalize your plan")).toBeOnTheScreen();
    expect(screen.getByText('Lose weight')).toBeOnTheScreen();
    expect(screen.getByText('Sustainable calorie deficit')).toBeOnTheScreen();
    expect(screen.getByText('Maintain weight')).toBeOnTheScreen();
    expect(screen.getByText('Stay at your current weight')).toBeOnTheScreen();
    expect(screen.getByText('Gain weight')).toBeOnTheScreen();
    expect(screen.getByText('Healthy calorie surplus')).toBeOnTheScreen();
    expect(screen.getByText('Build a habit')).toBeOnTheScreen();
    expect(screen.getByText('Just track, no calorie goal')).toBeOnTheScreen();
    for (const goal of ['lose', 'maintain', 'gain', 'habit']) {
      expect(screen.getByTestId(`onboarding.goalCard.${goal}`)).toBeOnTheScreen();
    }
  });

  it('single selection moves with the taps: lose then gain deselects lose', async () => {
    const model = makeModel();
    await render(<GoalPickerScreen model={model} />);

    await userEvent.press(screen.getByText('Lose weight'));
    expect(model.draft.goal).toBe('lose');
    // Exactly one card shows selected: the a11y label carries the state.
    expect(screen.getByRole('button', { name: 'Lose weight, Sustainable calorie deficit, selected' })).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Gain weight'));
    expect(model.draft.goal).toBe('gain');
    expect(screen.getByRole('button', { name: 'Gain weight, Healthy calorie surplus, selected' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Lose weight, Sustainable calorie deficit, selected' })).toBeNull();
  });

  it('the pinned Continue CTA advances to the body metrics step', async () => {
    const model = makeModel();
    model.advance(); // value hero → goal: the screen runs on the goal step
    await render(<GoalPickerScreen model={model} />);

    expect(screen.getByTestId('onboarding.continue')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(model.path[model.path.length - 1]).toBe('bodyMetrics');
  });
});
