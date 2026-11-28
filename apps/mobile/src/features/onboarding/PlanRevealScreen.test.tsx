/**
 * RNTL screen test of PlanRevealView.swift (OB-09): the locked copy, the macro
 * rings, the weekly range, the edit panel with its engine-clamped edits, the
 * persist error banner and the finish handoff.
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

import { setEdSafeMode } from '../../design';

import { PlanRevealScreen } from './PlanRevealScreen';
import { onboardingCopy } from './onboardingCopy';
import { createOnboardingModel } from './onboardingModel';

/** The default draft walked to the reveal: lose/female lands 1693 kcal, unfloored. */
function makeModel(saveTarget: (target: unknown) => Promise<void> = async () => undefined) {
  const model = createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-09-14T00:00:00Z'),
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    saveTarget,
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
  });
  for (let index = 0; index < 7; index += 1) model.advance();
  model.finishGenerationForTesting();
  return model;
}

describe('plan reveal screen', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('shows the locked copy, the kcal hero, the macro rings and the weekly range', async () => {
    await render(<PlanRevealScreen model={makeModel()} onFinished={jest.fn()} />);

    expect(screen.getByText('Your daily target')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.reveal')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.kcalHero')).toBeOnTheScreen();
    expect(screen.getByText('1693')).toBeOnTheScreen();
    expect(screen.getByText('calories per day')).toBeOnTheScreen();
    expect(screen.getByLabelText('1693 calories per day')).toBeOnTheScreen();
    // Macro rings: 127 / 169 / 56 at 30/40/30 of 1693, with the Swift labels.
    expect(screen.getByTestId('plan.macro.protein')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.macro.carbs')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.macro.fat')).toBeOnTheScreen();
    expect(screen.getByText('127g')).toBeOnTheScreen();
    expect(screen.getByText('169g')).toBeOnTheScreen();
    expect(screen.getByText('56g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein 127 grams')).toBeOnTheScreen();
    expect(screen.getByText('Weekly range')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.weeklyRange')).toBeOnTheScreen();
    expect(screen.getByText('11,601 – 12,101 calories')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.weeklyRangeCaption)).toBeOnTheScreen();
    expect(screen.getByText('Not right? Adjust targets')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.adjust')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.medicalDisclaimer')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.medicalDisclaimer)).toBeOnTheScreen();
    // The default plan is unfloored: no safety-floor banner yet.
    expect(screen.queryByTestId('plan.safetyFloor')).toBeNull();
  });

  it('the edit panel adjusts kcal through the engine and shows the floor banner below it', async () => {
    const model = makeModel();
    await render(<PlanRevealScreen model={model} onFinished={jest.fn()} />);
    expect(screen.queryByText('Daily calories')).toBeNull();

    await userEvent.press(screen.getByRole('button', { name: 'Not right? Adjust targets' }));
    expect(screen.getByText('Daily calories')).toBeOnTheScreen();
    // 'Protein' / 'Carbs' / 'Fat' show twice: macro ring labels + edit row labels.
    expect(screen.getAllByText('Protein')).toHaveLength(2);
    expect(screen.getAllByText('Carbs')).toHaveLength(2);
    expect(screen.getAllByText('Fat')).toHaveLength(2);
    expect(screen.getByTestId('plan.editKcal')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editProtein')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editCarbs')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editFat')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editKcal.decrement')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editKcal.increment')).toBeOnTheScreen();

    // Ten −50 presses drive 1693 under the 1,200 female floor: the engine clamps.
    for (let index = 0; index < 10; index += 1) {
      await userEvent.press(screen.getByTestId('plan.editKcal.decrement'));
    }
    // The floored value shows in the hero and the edit row.
    expect(screen.getAllByText('1200').length).toBeGreaterThanOrEqual(1);
    expect(model.reveal?.floored).toBe(true);
    expect(screen.getByTestId('plan.safetyFloor')).toBeOnTheScreen();
    expect(screen.getByText('Safety floor:')).toBeOnTheScreen();

    // A protein edit below the floor re-clamps to the floor and re-derives 30/40/30
    // of 1200: the kcal stays pinned and the grams return to the engine's split.
    await userEvent.press(screen.getByTestId('plan.editProtein.decrement'));
    expect(screen.getAllByText('1200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('90g')).toBeOnTheScreen();
  });

  it('a failed save shows the verbatim persist error banner and does not finish', async () => {
    const onFinished = jest.fn();
    const model = makeModel(async () => {
      throw new Error('disk full');
    });
    await render(<PlanRevealScreen model={model} onFinished={onFinished} />);

    await userEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('plan.persistError')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.persistError)).toBeOnTheScreen();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('a successful save hands off to the Today tab through onFinished', async () => {
    const saveTarget = jest.fn(async () => undefined);
    const onFinished = jest.fn();
    const model = makeModel(saveTarget);
    await render(<PlanRevealScreen model={model} onFinished={onFinished} />);

    await userEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(model.finished).toBe(true);
    expect(saveTarget).toHaveBeenCalledTimes(1);
  });

  it('renders neither the kcal hero nor the weekly range in ED-safe mode', async () => {
    setEdSafeMode(true);
    await render(<PlanRevealScreen model={makeModel()} onFinished={jest.fn()} />);

    // The kcal hero collapses entirely: number, subtitle and the announced range.
    expect(screen.queryByTestId('plan.kcalHero')).toBeNull();
    expect(screen.queryByText('calories per day')).toBeNull();
    expect(screen.queryByLabelText('1693 calories per day')).toBeNull();
    // The weekly range line collapses; the card, headline and caption stay.
    expect(screen.queryByTestId('plan.weeklyRange')).toBeNull();
    expect(screen.queryByText('11,601 – 12,101 calories')).toBeNull();
    expect(screen.getByText('Weekly range')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.weeklyRangeCaption)).toBeOnTheScreen();
    // The non-calorie surfaces stay: rings, adjust panel, disclaimer, continue.
    expect(screen.getByTestId('plan.macro.protein')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.adjust')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.medicalDisclaimer')).toBeOnTheScreen();
  });

  it('the edit panel hides the kcal row in ED-safe mode and keeps the macro grams', async () => {
    setEdSafeMode(true);
    await render(<PlanRevealScreen model={makeModel()} onFinished={jest.fn()} />);

    await userEvent.press(screen.getByRole('button', { name: 'Not right? Adjust targets' }));
    // The kcal row collapses with its steppers; 'Daily calories' is gone.
    expect(screen.queryByText('Daily calories')).toBeNull();
    expect(screen.queryByTestId('plan.editKcal')).toBeNull();
    expect(screen.queryByTestId('plan.editKcal.decrement')).toBeNull();
    expect(screen.queryByTestId('plan.editKcal.increment')).toBeNull();
    // The macro grams stay editable (the decision: ED-safe hides kcal only).
    expect(screen.getByTestId('plan.editProtein')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editCarbs')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editFat')).toBeOnTheScreen();
    expect(screen.getByTestId('plan.editProtein.decrement')).toBeOnTheScreen();
  });
});
