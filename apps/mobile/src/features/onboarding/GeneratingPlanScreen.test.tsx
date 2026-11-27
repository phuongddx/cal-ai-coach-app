/**
 * RNTL screen test of GeneratingPlanView.swift (OB-08): the ring, the locked
 * 4-step checklist and the identifiers; with `disableAnimations` the steps flip
 * instantly and the flow lands on plan reveal.
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

import { act, render, screen } from '@testing-library/react-native';

import { GeneratingPlanScreen } from './GeneratingPlanScreen';
import { createOnboardingModel } from './onboardingModel';

function makeModel(disableAnimations: boolean) {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    disableAnimations,
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
}

describe('generating plan screen', () => {
  it('shows the locked copy, the ring identifier and the 4-step checklist identifiers', async () => {
    const model = makeModel(true);
    await render(<GeneratingPlanScreen model={model} />);

    expect(screen.getByTestId('onboarding.generating')).toBeOnTheScreen();
    expect(screen.getByText('Creating your plan')).toBeOnTheScreen();
    expect(screen.getByText('Personalizing based on your goals')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.generatingPercent')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.genStep.0')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.genStep.1')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.genStep.2')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.genStep.3')).toBeOnTheScreen();
    // The locked checklist copy, in order.
    expect(screen.getByText('Calculating TDEE')).toBeOnTheScreen();
    expect(screen.getByText('Setting macro ratios')).toBeOnTheScreen();
    expect(screen.getByText('Applying safety floor')).toBeOnTheScreen();
    expect(screen.getByText('Generating weekly plan')).toBeOnTheScreen();
  });

  it('with disableAnimations the steps flip instantly to 100% and the reveal lands', async () => {
    const model = makeModel(true);
    await render(<GeneratingPlanScreen model={model} />);

    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Generating your plan, 100%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calculating TDEE, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('Generating weekly plan, done')).toBeOnTheScreen();
    // The flow moved on: the model's path now ends at plan reveal.
    expect(model.path[model.path.length - 1]).toBe('planReveal');
  });

  it('without the flag the checklist starts the first step and can land the reveal through the seam', async () => {
    const model = makeModel(false);
    await render(<GeneratingPlanScreen model={model} />);

    // The first step is active the moment the screen appears (Swift .task) at 25%.
    expect(screen.getByText('25%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Generating your plan, 25%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calculating TDEE, in progress')).toBeOnTheScreen();
    expect(screen.getByLabelText('Setting macro ratios, waiting')).toBeOnTheScreen();
    expect(screen.getByLabelText('Generating weekly plan, waiting')).toBeOnTheScreen();

    // The window is still running (2 s minimum, 0.5 s per step); the test seam
    // lands the reveal immediately, and the screen follows the model.
    await act(async () => {
      model.finishGenerationForTesting();
    });
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Setting macro ratios, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('Applying safety floor, done')).toBeOnTheScreen();
    expect(model.path[model.path.length - 1]).toBe('planReveal');
    model.dispose();
  });
});
