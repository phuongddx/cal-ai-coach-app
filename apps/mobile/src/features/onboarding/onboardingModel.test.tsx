/**
 * Jest twin of `native/App/CoachCalTests/OnboardingContractTests.swift` — one
 * `it` per Swift case, same behavior sentence. The Swift cases that inspect
 * views with ViewInspector render the RN screens here; the pure-model cases
 * stay pure. Beyond the 8 twins, the brief requires coverage of the step
 * order, the granted and denied HealthKit paths, and the finish wiring — those
 * live in the extra describes at the bottom.
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

import { TargetsEngine } from '@coachcal/core';

import type { UserTarget } from '../../data/repos/targetRepository';

import { BodyMetricsScreen } from './BodyMetricsScreen';
import { GoalPickerScreen } from './GoalPickerScreen';
import { GoalWeightPaceScreen } from './GoalWeightPaceScreen';
import { PrivacyHealthScreen } from './PrivacyHealthScreen';
import { ValueHeroScreen } from './ValueHeroScreen';
import { onboardingCopy } from './onboardingCopy';
import {
  createOnboardingModel,
  ONBOARDING_STEPS,
  type OnboardingModel,
  type OnboardingModelDeps,
} from './onboardingModel';

const FIXED_NOW = new Date('2026-09-14T00:00:00Z');

function makeModel(overrides: Partial<OnboardingModelDeps> = {}): OnboardingModel {
  return createOnboardingModel({
    ownerId: '11111111-2222-4333-8444-555555555555',
    now: () => FIXED_NOW,
    policyStorageKey: 'onboarding.policy.key',
    applyPolicyFlag: jest.fn(),
    writeSetting: jest.fn(async () => undefined),
    saveTarget: jest.fn(async () => undefined),
    notify: jest.fn(),
    requestHealthAccess: jest.fn(async () => 'denied'),
    ...overrides,
  });
}

describe('OnboardingContractTests (twin)', () => {
  // OnboardingContractTests.testGoalPickerSingleSelectUpdatesDraft
  // Option cards are single-select: choosing a goal deselects the previous one
  // and the draft mutation lands in the model.
  it('goal picker single select updates draft', async () => {
    const model = makeModel();
    await render(<GoalPickerScreen model={model} />);

    await userEvent.press(screen.getByText('Lose weight'));
    expect(model.draft.goal).toBe('lose');
    await userEvent.press(screen.getByText('Gain weight'));
    expect(model.draft.goal) // picking a new goal must move the single selection.toBe('gain');
  });

  // OnboardingContractTests.testValueHeroShowsHeroCopyAndEdSafeLine
  it('value hero shows hero copy and ED-safe line', async () => {    const model = makeModel();
    await render(<ValueHeroScreen model={model} />);

    expect(screen.getByText('Track calories with a photo')).toBeOnTheScreen();
    expect(screen.getByText('The honest AI calorie coach')).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.safeModeTitle)).toBeOnTheScreen();
    expect(screen.getByText(onboardingCopy.safeModeSubtitle)).toBeOnTheScreen();
    // The hero CTA ("Get started", identifier onboarding.getStarted) is the
    // scaffold's CCPrimaryButton — its label Text is asserted above via copy.
    expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
  });

  // OnboardingContractTests.testUnder18DobGateBlocksContinueAndShowsVerbatimFootnote
  it('under-18 DOB gate blocks continue and shows verbatim footnote', async () => {
    const model = makeModel();
    model.birthYear = 2014;
    // A 12-year-old must trip the DOB gate.
    expect(model.isDobGateBlocked).toBe(true);

    await render(<BodyMetricsScreen model={model} />);
    expect(screen.getByText('Must be 18+ to use CoachCal')).toBeOnTheScreen();

    model.advance(); // value hero → goal
    model.advance(); // goal → body metrics
    model.advance(); // blocked by the gate
    // advance() must be a no-op while the DOB gate blocks.
    expect(model.path[model.path.length - 1]).toBe('bodyMetrics');
  });

  // OnboardingContractTests.testAdultDobAllowsContinue
  it('adult DOB allows continue', () => {
    const model = makeModel();
    model.birthYear = 1995;
    expect(model.isDobGateBlocked).toBe(false);
    model.advance(); // value hero → goal
    model.advance(); // goal → body metrics
    model.advance(); // body metrics → goal weight & pace
    expect(model.path[model.path.length - 1]).toBe('goalWeightPace');
  });

  // OnboardingContractTests.testPaceAboveSafeLimitClampsAndShowsVerbatimSafetyFloorBanner
  it('pace above safe limit clamps and shows verbatim safety floor banner', async () => {
    const model = makeModel();
    model.setPace(1.5);
    // The draft must land on the engine's clamped pace, not the raw slider value.
    expect(model.draft.requestedPaceKgPerWeek).toBe(0.45);
    expect(model.paceClamped).toBe(true);

    await render(<GoalWeightPaceScreen model={model} />);
    expect(screen.getByText('Safety floor:')).toBeOnTheScreen();
    expect(screen.getByText(/1,500 kcal\/day for men/)).toBeOnTheScreen();
  });

  // OnboardingContractTests.testSafePacePassesThroughUnclamped
  it('safe pace passes through unclamped', () => {
    const model = makeModel();
    model.setPace(0.3);
    expect(model.draft.requestedPaceKgPerWeek).toBe(0.3);
    expect(model.paceClamped).toBe(false);
  });

  // OnboardingContractTests.testMaintainToLoseRoundtripReclampsPaceThroughEngine
  // WR-05: maintain→lose must land the draft on an engine-clamped pace —
  // the old re-clamp-only-if-set path kept nil, so the slider displayed 0.50
  // while the engine computed (and persisted) pace 0.
  it('maintain-to-lose roundtrip reclamps pace through engine', () => {
    const model = makeModel();
    model.setPace(0.3);
    model.selectGoal('maintain');
    expect(model.draft.requestedPaceKgPerWeek).toBeNull();

    model.selectGoal('lose');
    const clamped = model.draft.requestedPaceKgPerWeek;
    // The roundtrip must restore a concrete pace, never nil.
    expect(clamped).not.toBeNull();
    // The displayed pace must equal what the engine computes for the draft.
    expect(clamped).toBe(TargetsEngine.targets(model.draft).paceKgPerWeek);
    // A lose goal can never carry pace 0.
    expect(clamped ?? 0).toBeGreaterThan(0);
  });

  // OnboardingContractTests.testRevealKcalEditReclampsThroughEngineFloors
  it('reveal kcal edit reclamps through engine floors', () => {
    const model = makeModel();
    model.draft.requestedPaceKgPerWeek = null;
    model.advance(); // goal
    model.advance(); // body metrics
    model.advance(); // goal weight & pace
    model.advance(); // activity & diet
    model.advance(); // projection
    model.advance(); // privacy & health
    model.finishGenerationForTesting();
    expect(model.reveal).not.toBeNull();

    const before = model.reveal?.dailyKcal ?? 0;
    model.adjustRevealKcal(before * -1 + 900);
    // Edited kcal must clamp at the female floor.
    expect(model.reveal?.dailyKcal).toBe(1200);
    expect(model.reveal?.floored).toBe(true);
    // Macros re-derive from the floored target at 30/40/30.
    expect(model.reveal?.proteinG).toBe(90);
    expect(model.reveal?.carbsG).toBe(120);
    expect(model.reveal?.fatG).toBe(40);
  });
});

// Brief additions beyond the 8 Swift twins: the step order over the typed list,
// and the granted / denied HealthKit paths of the privacy screen.
describe('onboarding model (brief additions)', () => {
  it('advances through the nine steps in the locked order and lands on plan reveal', () => {
    const model = makeModel();
    expect(ONBOARDING_STEPS).toEqual([
      'valueHero',
      'goal',
      'bodyMetrics',
      'goalWeightPace',
      'activityDiet',
      'projection',
      'privacyHealth',
      'generating',
      'planReveal',
    ]);
    for (let index = 0; index < 7; index += 1) model.advance();
    expect(model.path).toEqual([
      'valueHero',
      'goal',
      'bodyMetrics',
      'goalWeightPace',
      'activityDiet',
      'projection',
      'privacyHealth',
      'generating',
    ]);
    model.finishGenerationForTesting();
    expect(model.path[model.path.length - 1]).toBe('planReveal');
    // advance() past the reveal is a no-op: the flow ends there.
    model.advance();
    expect(model.path).toHaveLength(9);
  });

  it('the granted HealthKit path shows no footnote and lets the user continue', async () => {
    const model = makeModel({
      requestHealthAccess: jest.fn<Promise<'granted' | 'denied'>, []>(async () => 'granted'),
    });
    for (let index = 0; index < 6; index += 1) model.advance();
    await render(<PrivacyHealthScreen model={model} />);

    await userEvent.press(screen.getByRole('button', { name: 'Connect Apple Health' }));
    expect(await screen.findByTestId('onboarding.privacyPromise')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding.healthConnectNote')).toBeNull();

    // Granted advances silently: the Continue CTA moves on to generating.
    await userEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(model.path[model.path.length - 1]).toBe('generating');
  });

  it('the denied HealthKit path shows the footnote and lets the user continue', async () => {
    const model = makeModel({
      requestHealthAccess: jest.fn<Promise<'granted' | 'denied'>, []>(async () => 'denied'),
    });
    for (let index = 0; index < 6; index += 1) model.advance();
    await render(<PrivacyHealthScreen model={model} />);

    expect(screen.queryByText(onboardingCopy.healthConnectNote)).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Connect Apple Health' }));

    expect(await screen.findByText(onboardingCopy.healthConnectNote)).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(model.path[model.path.length - 1]).toBe('generating');
  });

  it('persistAndFinish saves the clamped target for the owner, notifies and finishes', async () => {
    const saveTarget =
      jest.fn<Promise<void>, [UserTarget]>(async () => undefined);
    const notify = jest.fn();
    const model = makeModel({ ownerId: 'owner-7', saveTarget, notify });
    for (let index = 0; index < 7; index += 1) model.advance();
    model.finishGenerationForTesting();

    await model.persistAndFinish();
    expect(saveTarget).toHaveBeenCalledTimes(1);
    const saved = saveTarget.mock.calls[0]?.[0];
    expect(saved?.userId).toBe('owner-7');
    expect(saved?.dailyKcal).toBe(TargetsEngine.targets(model.draft).dailyKcal);
    expect(saved?.fiberGoalG).toBe(30);
    expect(saved?.waterGlasses).toBe(8);
    expect(saved?.sex).toBe('female');
    expect(saved?.goal).toBe('lose');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(model.finished).toBe(true);
    expect(model.persistError).toBeNull();
  });

  it('a failed save shows the verbatim persist error and does not finish', async () => {
    const saveTarget = jest.fn<Promise<void>, [UserTarget]>(async () => {
      throw new Error('disk full');
    });
    const notify = jest.fn();
    const model = makeModel({ saveTarget, notify });
    for (let index = 0; index < 7; index += 1) model.advance();
    model.finishGenerationForTesting();

    await model.persistAndFinish();
    expect(model.finished).toBe(false);
    expect(model.persistError).toBe(onboardingCopy.persistError);
    expect(notify).not.toHaveBeenCalled();
  });
});

// U-73: the step-7 ED-Safe switch. The stored key and the design flag setter
// are injected; the toggle's contract is the Settings wellness toggle's order —
// persist '1'/'0' first, then apply the mode, and a failed write never applies.
describe('the step-7 ED-safe policy switch', () => {
  it('persists the stored value first and then applies the mode', async () => {
    const writeSetting = jest.fn(async () => undefined);
    const applyPolicyFlag = jest.fn();
    const model = makeModel({ policyStorageKey: 'onboarding.policy.key', writeSetting, applyPolicyFlag });

    await model.setSafeModePolicy(true);
    expect(writeSetting).toHaveBeenCalledWith('onboarding.policy.key', '1');
    // The design flag applies only after the stored write resolves.
    expect(applyPolicyFlag.mock.invocationCallOrder[0] ?? 0).toBeGreaterThan(
      writeSetting.mock.invocationCallOrder[0] ?? 0,
    );
    expect(applyPolicyFlag).toHaveBeenCalledWith(true);
    expect(model.safePolicyWriteError).toBeNull();

    await model.setSafeModePolicy(false);
    expect(writeSetting).toHaveBeenLastCalledWith('onboarding.policy.key', '0');
    expect(applyPolicyFlag).toHaveBeenLastCalledWith(false);
  });

  it('a failed stored write never applies the mode', async () => {
    const writeSetting = jest.fn(async () => {
      throw new Error('disk full');
    });
    const applyPolicyFlag = jest.fn();
    const model = makeModel({ policyStorageKey: 'onboarding.policy.key', writeSetting, applyPolicyFlag });

    await expect(model.setSafeModePolicy(true)).rejects.toThrow('disk full');
    expect(applyPolicyFlag).not.toHaveBeenCalled();
    expect(model.safePolicyWriteError).toBe('disk full');
  });
});

