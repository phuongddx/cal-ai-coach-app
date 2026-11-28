/**
 * RNTL screen test of GeneratingPlanView.swift (OB-08), U-73: the locked
 * title, the ring without a percent readout, and the formula lines the engine
 * computes — they equal the engine's numbers over the same draft. Stage A2:
 * the step holds until the user taps "See your plan" (no auto-advance), and
 * under ED-safe mode it shows the design system's balancing note and the
 * button, with no number.
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

import { ACTIVITY_MULTIPLIER, TargetsEngine } from '@coachcal/core';

import { setEdSafeMode } from '../../design';

import { GeneratingPlanScreen } from './GeneratingPlanScreen';
import { grouped } from './format';
import { createOnboardingModel } from './onboardingModel';

function makeModel() {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
  });
}

describe('generating plan screen', () => {
  it('shows the locked copy and the formula lines the engine computed', async () => {
    const model = makeModel();
    await render(<GeneratingPlanScreen model={model} />);

    expect(screen.getByTestId('onboarding.generating')).toBeOnTheScreen();
    expect(screen.getByText('Creating your plan')).toBeOnTheScreen();
    expect(screen.getByText('Personalizing based on your goals')).toBeOnTheScreen();

    // The formula lines equal the engine's numbers over the same draft.
    const bmr = TargetsEngine.bmr(model.draft);
    const tdee = TargetsEngine.tdee(bmr, model.draft.activityLevel);
    const targets = TargetsEngine.targets(model.draft);
    expect(screen.getByText('Resting energy (Mifflin-St Jeor)')).toBeOnTheScreen();
    expect(screen.getByText(grouped(bmr))).toBeOnTheScreen();
    expect(screen.getByText(`× Moderately active ${ACTIVITY_MULTIPLIER.moderate}`)).toBeOnTheScreen();
    expect(screen.getByText(grouped(tdee))).toBeOnTheScreen();
    expect(screen.getByText(`− Pace ${targets.paceKgPerWeek.toFixed(2)} kg/week`)).toBeOnTheScreen();
    expect(screen.getByText(`−${grouped(tdee - targets.dailyKcal)}`)).toBeOnTheScreen();
    expect(screen.getByText('Daily target')).toBeOnTheScreen();
    expect(screen.getByText(`${grouped(targets.dailyKcal)} kcal`)).toBeOnTheScreen();

    // No percent readout and no checklist steps: the app invents no number.
    expect(screen.queryByTestId('onboarding.generatingPercent')).toBeNull();
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.queryByText('25%')).toBeNull();
    expect(screen.queryByTestId('onboarding.genStep.0')).toBeNull();
    expect(screen.queryByText('Calculating TDEE')).toBeNull();
  });

  it('the step holds until the user taps its primary button, which lands the reveal', async () => {
    const model = makeModel();
    // Walk the quiz to the generating step, as the flow does.
    for (let index = 0; index < 7; index += 1) model.advance();
    await render(<GeneratingPlanScreen model={model} />);

    // The engine's numbers are on the model, but the step does not advance by
    // itself (stage A2, decision 2): the path still ends at generating.
    expect(model.targets).not.toBeNull();
    expect(model.path[model.path.length - 1]).toBe('generating');

    // The pinned primary button is the only way past: it advances to step 9.
    expect(screen.getByTestId('onboarding.continue')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'See your plan' }));
    expect(model.path[model.path.length - 1]).toBe('planReveal');
  });

  it('under ED-safe mode the step shows the balancing note and the button, and no number', async () => {
    setEdSafeMode(true);
    try {
      const model = makeModel();
      // Walk the quiz to the generating step, as the flow does.
      for (let index = 0; index < 7; index += 1) model.advance();
      await render(<GeneratingPlanScreen model={model} />);

      // The design system's note renders only while the mode is on; the
      // formula card is collapsed, so no number shows anywhere.
      expect(screen.getByTestId('ed-safe-note')).toBeOnTheScreen();
      expect(screen.getByText('Balancing your meals')).toBeOnTheScreen();
      expect(screen.queryByText('Resting energy (Mifflin-St Jeor)')).toBeNull();
      expect(
        screen.queryByText(`${grouped(TargetsEngine.targets(model.draft).dailyKcal)} kcal`),
      ).toBeNull();
      // The step still holds, and the button still works under ED-safe mode.
      expect(model.path[model.path.length - 1]).toBe('generating');
      await userEvent.press(screen.getByRole('button', { name: 'See your plan' }));
      expect(model.path[model.path.length - 1]).toBe('planReveal');
    } finally {
      setEdSafeMode(false);
    }
  });
});
