/**
 * RNTL screen test of ActivityDietView.swift (OB-05): the locked copy, the
 * five activity card identifiers and the five diet chip identifiers.
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

import { ActivityDietScreen } from './ActivityDietScreen';
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

describe('activity and diet screen', () => {
  it('shows the locked copy and both section headers', async () => {
    await render(<ActivityDietScreen model={makeModel()} />);

    expect(screen.getByText('Lifestyle')).toBeOnTheScreen();
    expect(screen.getByText('Fine-tune your calorie target')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.activityHeader')).toBeOnTheScreen();
    expect(screen.getByText('Activity level')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.dietHeader')).toBeOnTheScreen();
    expect(screen.getByText('Diet style (optional)')).toBeOnTheScreen();
  });

  it('carries all five activity card identifiers and selects through the model', async () => {
    const model = makeModel();
    await render(<ActivityDietScreen model={model} />);

    for (const level of ['sedentary', 'light', 'moderate', 'active', 'athlete']) {
      expect(screen.getByTestId(`onboarding.activityCard.${level}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('Sedentary')).toBeOnTheScreen();
    expect(screen.getByText('Light exercise 1–3 days a week')).toBeOnTheScreen();

    await userEvent.press(screen.getByText('Very active'));
    expect(model.draft.activityLevel).toBe('active');
    expect(
      screen.getByRole('button', { name: 'Very active, Hard exercise 6–7 days a week, selected' }),
    ).toBeOnTheScreen();
  });

  it('carries all five diet chip identifiers and selects through the model', async () => {
    const model = makeModel();
    await render(<ActivityDietScreen model={model} />);

    for (const chip of ['standard', 'highprotein', 'vegetarian', 'vegan', 'keto']) {
      expect(screen.getByTestId(`onboarding.dietChip.${chip}`)).toBeOnTheScreen();
    }
    expect(screen.getByText('High protein')).toBeOnTheScreen();

    await userEvent.press(screen.getByText('Keto'));
    expect(model.dietStyle).toBe('Keto');
    await userEvent.press(screen.getByText('Standard'));
    expect(model.dietStyle).toBe('Standard');
  });
});
