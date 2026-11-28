/**
 * TargetEditSheet over the REAL TargetEditModel with the model changing while the sheet is mounted
 * (U-84 B). The app compiles with the React Compiler, which treats a value that keeps its identity
 * as unchanged: a view that subscribes to the revision, throws it away and calls `model.macros()` in
 * render keeps drawing the old macro line after a step. Jest does not compile, so these cases only
 * go red under `npm run test:compiler`.
 *
 * Dual-react preamble: see TargetEditSheet.test.tsx and findings/U-22.md.
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
import { setEdSafeMode } from '../../design';

import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import type { UserTarget } from '../../data/repos/targetRepository';

import { TargetEditSheet } from './TargetEditSheet';
import { createTargetEditModel } from './targetEditModel';

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

function makeModel() {
  return createTargetEditModel({ initial: makeTarget(), now: () => FIXED_NOW, saveTarget: async () => undefined });
}

describe('TargetEditSheet over the real model, model changing while mounted', () => {
  beforeEach(() => setEdSafeMode(false));
  afterEach(() => setEdSafeMode(false));

  it('a kcal step moves the kcal figure and the macro line', async () => {
    const model = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);
    expect(screen.getByText('2,150 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Protein 161 g · Carbs 215 g · Fat 72 g')).toBeOnTheScreen();

    await act(async () => {
      model.adjustKcal(-250);
    });

    const macros = model.macros();
    expect(screen.getByText('1,900 kcal')).toBeOnTheScreen();
    expect(screen.getByText(`Protein ${macros.proteinG} g · Carbs ${macros.carbsG} g · Fat ${macros.fatG} g`)).toBeOnTheScreen();
    expect(screen.queryByText('Protein 161 g · Carbs 215 g · Fat 72 g')).toBeNull();
  });

  it('dropping under the floor shows the safety banner and rising back clears it', async () => {
    const model = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);
    expect(screen.queryByTestId('settings.targetEdit.safetyFloor')).toBeNull();

    await act(async () => {
      model.adjustKcal(-1000);
    });
    expect(screen.getByTestId('settings.targetEdit.safetyFloor')).toBeOnTheScreen();

    await act(async () => {
      model.adjustKcal(500);
    });
    expect(screen.queryByTestId('settings.targetEdit.safetyFloor')).toBeNull();
  });

  it('a goal weight under the engine minimum shows the caution card and names the clamped value on the save', async () => {
    const model = makeModel();
    await render(<TargetEditSheet model={model} onDismiss={() => undefined} />);
    expect(screen.queryByTestId('settings.targetEdit.goalFloor')).toBeNull();
    expect(screen.getByText('Save goal')).toBeOnTheScreen();

    await act(async () => {
      model.setGoalWeight(30);
    });

    expect(screen.getByTestId('settings.targetEdit.goalFloor')).toBeOnTheScreen();
    expect(screen.getByText(`Save ${model.clampedGoalWeightKg} kg goal`)).toBeOnTheScreen();
  });
});
