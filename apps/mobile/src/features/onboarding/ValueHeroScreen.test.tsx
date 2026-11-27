/**
 * RNTL screen test of ValueHeroView.swift (OB-02): the locked copy and the
 * identifiers the XCUITest flow used.
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

import { ValueHeroScreen } from './ValueHeroScreen';
import { onboardingCopy } from './onboardingCopy';
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

describe('value hero screen', () => {
  it('shows the locked hero copy, the three feature rows and the ED-safe line', async () => {
    await render(<ValueHeroScreen model={makeModel()} />);

    expect(screen.getByText('Track calories with a photo')).toBeOnTheScreen();
    expect(screen.getByText('The honest AI calorie coach')).toBeOnTheScreen();
    expect(screen.getByText('AI estimates with confidence')).toBeOnTheScreen();
    expect(screen.getByText('See when AI is certain vs. guessing')).toBeOnTheScreen();
    expect(screen.getByText('Transparent pricing always')).toBeOnTheScreen();
    expect(screen.getByText('No hidden fees. Cancel anytime.')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.safeModeTitle)).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.safeModeSubtitle)).toBeOnTheScreen();
    // Feature rows expose a combined label, like the Swift accessibilityLabel.
    expect(screen.getByLabelText('AI estimates with confidence, See when AI is certain vs. guessing')).toBeOnTheScreen();
    expect(screen.getByLabelText(`ED-safe mode included, Focus on habits, not numbers`)).toBeOnTheScreen();
  });

  it('carries the onboarding.getStarted identifier and the CTA advances to the goal step', async () => {
    const model = makeModel();
    await render(<ValueHeroScreen model={model} />);

    expect(screen.getByTestId('onboarding.getStarted')).toBeOnTheScreen();
    expect(screen.getByText('Get started')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(model.path[model.path.length - 1]).toBe('goal');
  });
});
