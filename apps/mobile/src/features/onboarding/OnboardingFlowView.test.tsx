/**
 * Jest twin of `native/App/CoachCalUITests/OnboardingFlowTests.swift` — the
 * fresh-start walk through all eight quiz steps to the plan reveal and the
 * finish handoff, on the --ccDisableAnimations path (no native build here, so
 * the handoff lands on the flow's `onFinished` instead of the MainShell ring).
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

import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { OnboardingFlowView } from './OnboardingFlowView';
import { createOnboardingModel } from './onboardingModel';

describe('onboarding flow (OnboardingFlowTests twin)', () => {
  it('a fresh start walks all eight steps to the plan reveal with persisted targets', async () => {
    const saveTarget = jest.fn(async () => undefined);
    const onFinished = jest.fn();
    const model = createOnboardingModel({
      ownerId: '11111111-2222-4333-8444-555555555555',
      now: () => new Date('2026-09-14T00:00:00Z'),
      saveTarget,
      notify: jest.fn(),
      requestHealthAccess: jest.fn(async () => 'denied'),
      policyStorageKey: 'onboarding.policy.key',
      applyPolicyFlag: jest.fn(),
      writeSetting: jest.fn(async () => undefined),
    });
    await render(<OnboardingFlowView model={model} onFinished={onFinished} />);

    // 1. Value Hero
    expect(screen.getByTestId('onboarding.getStarted')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Get started' }));

    // 2. Goal Picker
    expect(await screen.findByTestId('onboarding.goalCard.lose')).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Lose weight'));
    await pressContinue();

    // 3. Body Metrics (adult birth year stays)
    expect(await screen.findByTestId('onboarding.dobField')).toBeOnTheScreen();
    await pressContinue();

    // 4. Goal Weight & Pace — the slider renders; clamping stays engine-owned.
    expect(await screen.findByTestId('onboarding.paceSlider')).toBeOnTheScreen();
    await pressContinue();

    // 5. Activity & Diet
    expect(await screen.findByTestId('onboarding.activityCard.moderate')).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Moderately active'));
    await pressContinue();

    // 6. Projection — kg + weeks stats, never calorie framing.
    expect(await screen.findByTestId('onboarding.projectionKg')).toBeOnTheScreen();
    await pressContinue();

    // 7. Privacy & Health — the connect button shows the footnote on denial;
    //    this step's CTA reads "Skip for now" with the continue identifier.
    expect(await screen.findByTestId('onboarding.healthConnect')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Connect Apple Health' }));
    expect(await screen.findByTestId('onboarding.healthConnectNote')).toBeOnTheScreen();
    await pressContinue('Skip for now');

    // 8. Generating → Plan Reveal (animations disabled: instant flip).
    expect(await screen.findByTestId('plan.reveal')).toBeOnTheScreen();

    // Handoff: targets persisted through saveTarget → the flow calls onFinished.
    await userEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(saveTarget).toHaveBeenCalledTimes(1);
    expect(model.finished).toBe(true);
  });

  async function pressContinue(name = 'Continue') {
    // The pinned CTA rides a wrapper View (the design-system button takes no
    // testID); press the visible button by role, assert the identifier.
    expect(screen.getByTestId('onboarding.continue')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name }));
  }
});
