/**
 * RNTL screen test of TargetEditSheet.swift (PR-03): the ±50 kcal steps with
 * the engine floor, the wheel-backed goal weight, the single save path through
 * the engine and the ED-safe collapse of the daily-target section.
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

import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { setEdSafeMode } from '../../design';

import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import type { UserTarget } from '../../data/repos/targetRepository';

import { TargetEditSheet } from './TargetEditSheet';
import { createTargetEditModel, type TargetEditModelDeps } from './targetEditModel';

const FIXED_NOW = new Date('2026-09-12T09:00:00Z');

function makeTarget(): UserTarget {
  return {
    id: '22222222-3333-4444-8555-666666666666',
    userId: DEMO_USER_ID,
    dailyKcal: 2150,
    proteinG: 161,
    carbsG: 215,
    fatG: 72,
    fiberGoalG: 30,
    waterGlasses: 8,
    sex: 'female',
    heightCm: 165,
    weightKg: 70,
    goalWeightKg: 65,
    paceKgPerWeek: 0.5,
    activity: 'moderate',
    goal: 'lose',
    updatedAt: FIXED_NOW,
  };
}

function makeModel(initial: UserTarget = makeTarget(), overrides: Partial<TargetEditModelDeps> = {}) {
  const saveTarget = jest.fn(async (_target: UserTarget) => undefined);
  const deps: TargetEditModelDeps = {
    initial,
    now: () => FIXED_NOW,
    saveTarget,
    ...overrides,
  };
  return { model: createTargetEditModel(deps), deps, saveTarget };
}

describe('target edit sheet', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('renders the title, the kcal stepper, the macro preview and the goal wheel', async () => {
    const { model } = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);

    expect(screen.getByText('Edit targets')).toBeOnTheScreen();
    expect(screen.getByText('Daily target')).toBeOnTheScreen();
    expect(screen.getByText('2,150 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Protein 161 g · Carbs 215 g · Fat 72 g')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.targetEdit.kcalDown')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.targetEdit.kcalUp')).toBeOnTheScreen();
    expect(screen.getByLabelText('Decrease daily target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Increase daily target')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.targetEdit.goalWeight')).toBeOnTheScreen();
    expect(screen.getByTestId('wheel-field:Goal weight')).toBeOnTheScreen();
    expect(screen.getByTestId('wheel-value:Goal weight')).toHaveTextContent('65 kg');
    expect(screen.getByTestId('settings.targetEdit.save')).toBeOnTheScreen();
    // The default plan is unfloored: no safety-floor banner yet.
    expect(screen.queryByTestId('settings.targetEdit.safetyFloor')).toBeNull();
  });

  it('steps the kcal by 50 and shows the engine floor banner below the floor', async () => {
    const { model } = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);

    await userEvent.press(screen.getByTestId('settings.targetEdit.kcalDown'));
    expect(screen.getByText('2,100 kcal')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('settings.targetEdit.kcalUp'));
    expect(screen.getByText('2,150 kcal')).toBeOnTheScreen();

    // 2150 − 50 × 20 drives under the 1,200 female floor: the engine clamps the
    // save (the display keeps the sub-floor edit, as the Swift sheet does) and
    // the macros preview re-derives from the unclamped display value.
    for (let index = 0; index < 20; index += 1) {
      await userEvent.press(screen.getByTestId('settings.targetEdit.kcalDown'));
    }
    expect(screen.getByText('1,150 kcal')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.targetEdit.safetyFloor')).toBeOnTheScreen();
    expect(screen.getByText('Safety floor:')).toBeOnTheScreen();
  });

  it('moves the goal weight through the wheel and saves the reclamped target through saveTarget', async () => {
    const { model, saveTarget } = makeModel();
    const onDismiss = jest.fn();
    await render(<TargetEditSheet model={model} onDismiss={onDismiss} />);

    // The wheel is a snap-scrolling list: a momentum end at one row height picks the next kg.
    await act(async () => {
      fireEvent(screen.getByTestId('wheel-scroll:Goal weight'), 'momentumScrollEnd', {
        nativeEvent: {
          contentOffset: { y: 36 },
          layoutMeasurement: { height: 108 },
          contentSize: { height: 36 * 111 },
        },
      });
    });
    expect(screen.getByTestId('wheel-value:Goal weight')).toHaveTextContent('41 kg');

    await userEvent.press(screen.getByTestId('settings.targetEdit.save'));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(saveTarget).toHaveBeenCalledTimes(1);
    const saved = saveTarget.mock.calls[0]?.[0] as UserTarget;
    expect(saved.id).toBe('22222222-3333-4444-8555-666666666666');
    expect(saved.dailyKcal).toBe(2150);
    expect(saved.goalWeightKg).toBe(41);
    expect(saved.proteinG).toBe(161);
    expect(saved.updatedAt).toBe(FIXED_NOW);
  });

  it('clamps a sub-floor save to the engine floor', async () => {
    const { model, saveTarget } = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);

    for (let index = 0; index < 20; index += 1) {
      await userEvent.press(screen.getByTestId('settings.targetEdit.kcalDown'));
    }
    await userEvent.press(screen.getByTestId('settings.targetEdit.save'));
    await waitFor(() => expect(saveTarget).toHaveBeenCalledTimes(1));
    const saved = saveTarget.mock.calls[0]?.[0] as UserTarget;
    expect(saved.dailyKcal).toBe(1200);
    expect(saved.proteinG).toBe(90);
    expect(saved.carbsG).toBe(120);
    expect(saved.fatG).toBe(40);
    expect(saved.goalWeightKg).toBe(65);
  });

  it('collapses the daily-target section under ED-safe mode and keeps the save path', async () => {
    setEdSafeMode(true);
    const { model, saveTarget } = makeModel();
    const onDismiss = jest.fn();
    await render(<TargetEditSheet model={model} onDismiss={onDismiss} />);

    expect(screen.queryByText('Daily target')).toBeNull();
    expect(screen.queryByTestId('settings.targetEdit.kcal')).toBeNull();
    expect(screen.queryByTestId('settings.targetEdit.safetyFloor')).toBeNull();
    // The wheel and the save stay reachable.
    expect(screen.getByTestId('settings.targetEdit.goalWeight')).toBeOnTheScreen();
    expect(screen.getByTestId('settings.targetEdit.save')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('settings.targetEdit.save'));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(saveTarget).toHaveBeenCalledTimes(1);
  });
});
