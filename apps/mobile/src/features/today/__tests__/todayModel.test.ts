/**
 * TodayModel over test doubles (standing-order rule 19): the readers, the water write, the clock and
 * the re-read signal are injected, so no database is involved. Proves the totals follow
 * `@coachcal/core` (TD-01), the water clamp, the day selection, the JIT Steps ask and the stale-read guard.
 */
import { dayKey, sumMacros } from '@coachcal/core';

import type { UserTarget } from '../../../data/repos/targetRepository';
import {
  consumedKcal,
  consumedMacro,
  createTodayModel,
  dayProgress,
  goalKcal,
  stepsDisplayValue,
  waterGlasses,
  weekStripDays,
  type StepsReader,
  type TodayMeal,
  type TodayModelDeps,
  type TodayReaders,
} from '../todayModel';

const NOW = new Date(2026, 8, 12, 9, 0, 0, 0);
const OWNER = 'user-1';

const TARGET: UserTarget = {
  id: 'target-1',
  userId: OWNER,
  dailyKcal: 2150,
  proteinG: 130,
  carbsG: 220,
  fatG: 70,
  fiberGoalG: 30,
  waterGlasses: 8,
  sex: 'female',
  heightCm: 165,
  weightKg: 82.4,
  goalWeightKg: 74,
  paceKgPerWeek: 0.5,
  activity: 'moderate',
  goal: 'lose',
  updatedAt: NOW,
};

function meal(id: string, overrides: Partial<TodayMeal> = {}): TodayMeal {
  return {
    id,
    title: `Meal ${id}`,
    mealSlot: 'lunch',
    kcal: 400,
    grams: 250,
    proteinG: 20,
    carbsG: 40,
    fatG: 10,
    fiberG: 5,
    confidence: 0.9,
    isSynced: true,
    loggedAt: NOW,
    ...overrides,
  };
}

type Harness = {
  deps: TodayModelDeps;
  readers: jest.Mocked<TodayReaders>;
  addWater: jest.Mock;
  notify: jest.Mock;
  fire: () => void;
};

function harness(opts: { meals?: TodayMeal[]; water?: number; steps?: StepsReader | null } = {}): Harness {
  const readers: jest.Mocked<TodayReaders> = {
    meals: jest.fn<Promise<TodayMeal[]>, [string, string]>(async () => opts.meals ?? []),
    activeTarget: jest.fn<Promise<UserTarget | null>, [string]>(async () => TARGET),
    waterMl: jest.fn<Promise<number>, [string]>(async () => opts.water ?? 0),
    streakState: jest.fn(async () => null),
  };
  const addWater = jest.fn(async () => undefined);
  const notify = jest.fn();
  const listeners = new Set<() => void>();
  const deps: TodayModelDeps = {
    readers,
    addWater,
    notify,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    now: () => NOW,
    ownerId: OWNER,
    steps: opts.steps ?? null,
  };
  return { deps, readers, addWater, notify, fire: () => listeners.forEach((l) => l()) };
}

describe('TodayModel', () => {
  it('reads the four sources for the owner and the day, and is not loaded before the first read', async () => {
    const h = harness({ meals: [meal('a')], water: 500 });
    const model = createTodayModel(h.deps);
    expect(model.getSnapshot().loaded).toBe(false);
    await model.refresh();
    const snap = model.getSnapshot();
    expect(snap.loaded).toBe(true);
    expect(h.readers.meals).toHaveBeenCalledWith(OWNER, dayKey(NOW));
    expect(h.readers.activeTarget).toHaveBeenCalledWith(OWNER);
    expect(h.readers.waterMl).toHaveBeenCalledWith(dayKey(NOW));
    expect(snap.waterMl).toBe(500);
    expect(snap.target).toEqual(TARGET);
  });

  it('totals follow @coachcal/core sumMacros, a meal without kcal counting 0', async () => {
    const meals = [
      meal('a', { kcal: 320, proteinG: 12.4, carbsG: 45.5, fatG: 8.25, fiberG: 3 }),
      meal('b', { kcal: 515, proteinG: 30.1, carbsG: 20, fatG: 20.5, fiberG: 4.5 }),
      meal('c', { kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null }),
    ];
    const h = harness({ meals });
    const model = createTodayModel(h.deps);
    await model.refresh();
    const snap = model.getSnapshot();
    const expected = sumMacros(
      meals.map((m) => ({
        kcal: m.kcal ?? 0,
        proteinG: m.proteinG ?? 0,
        carbsG: m.carbsG ?? 0,
        fatG: m.fatG ?? 0,
        fiberG: m.fiberG ?? 0,
      })),
    );
    expect(consumedKcal(snap)).toBe(expected.kcal);
    expect(consumedMacro(snap, 'protein')).toBe(expected.proteinG);
    expect(consumedMacro(snap, 'carbs')).toBe(expected.carbsG);
    expect(consumedMacro(snap, 'fat')).toBe(expected.fatG);
    expect(consumedMacro(snap, 'fiber')).toBe(expected.fiberG);
    expect(consumedKcal(snap)).toBe(835);
    expect(goalKcal(snap)).toBe(2150);
  });

  it('shows no goal and the default 8 glasses until a target exists', async () => {
    const h = harness();
    h.readers.activeTarget.mockResolvedValue(null);
    const model = createTodayModel(h.deps);
    await model.refresh();
    expect(goalKcal(model.getSnapshot())).toBeNull();
    expect(waterGlasses(model.getSnapshot())).toBe(8);
  });

  it('re-reads on the sync runtime signal', async () => {
    const h = harness({ meals: [meal('a')] });
    const model = createTodayModel(h.deps);
    await model.refresh();
    h.readers.meals.mockResolvedValue([meal('a'), meal('b')]);
    h.fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(model.getSnapshot().meals.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('selecting another day re-queries the meals of that day; selecting the same day does nothing', async () => {
    const h = harness();
    const model = createTodayModel(h.deps);
    await model.refresh();
    const yesterday = new Date(2026, 8, 11, 9, 0, 0, 0);
    h.readers.meals.mockClear();
    model.selectDay(NOW);
    expect(h.readers.meals).not.toHaveBeenCalled();
    model.selectDay(yesterday);
    await model.refresh();
    expect(h.readers.meals).toHaveBeenCalledWith(OWNER, '2026-09-11');
    expect(model.getSnapshot().selectedDay).toBe(yesterday);
  });

  it('a slower read that started earlier cannot overwrite a newer one', async () => {
    const h = harness();
    const model = createTodayModel(h.deps);
    let releaseFirst: (rows: TodayMeal[]) => void = () => undefined;
    h.readers.meals.mockImplementationOnce(() => new Promise<TodayMeal[]>((resolve) => (releaseFirst = resolve)));
    const first = model.refresh();
    h.readers.meals.mockResolvedValueOnce([meal('fresh')]);
    await model.refresh();
    releaseFirst([meal('stale')]);
    await first;
    expect(model.getSnapshot().meals.map((m) => m.id)).toEqual(['fresh']);
  });

  it('keeps the last snapshot when a read fails', async () => {
    const h = harness({ meals: [meal('a')] });
    const model = createTodayModel(h.deps);
    await model.refresh();
    h.readers.meals.mockRejectedValue(new Error('pool closed'));
    await model.refresh();
    expect(model.getSnapshot().meals.map((m) => m.id)).toEqual(['a']);
  });

  it('water quick add writes the delta for the selected day and notifies', async () => {
    const h = harness({ water: 1250 });
    const model = createTodayModel(h.deps);
    await model.refresh();
    await model.logWaterDelta(250);
    expect(h.addWater).toHaveBeenCalledWith(250, dayKey(NOW), OWNER, NOW);
    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  it('water quick add clamps so the day total never goes below 0', async () => {
    const h = harness({ water: 100 });
    const model = createTodayModel(h.deps);
    await model.refresh();
    await model.logWaterDelta(-250);
    expect(h.addWater).toHaveBeenCalledWith(-100, dayKey(NOW), OWNER, NOW);
    h.addWater.mockClear();
    h.readers.waterMl.mockResolvedValue(0);
    await model.refresh();
    await model.logWaterDelta(-250);
    expect(h.addWater).not.toHaveBeenCalled();
  });

  it('the Steps card shows "—" with no reader, then the count after the JIT ask', async () => {
    const none = createTodayModel(harness().deps);
    await none.refresh();
    await none.loadStepsIfNeeded();
    expect(stepsDisplayValue(none.getSnapshot())).toBe('—');

    const steps: StepsReader = {
      requestAuthorizationIfNeeded: jest.fn(async () => true),
      todayStepCount: jest.fn(async () => 8421),
    };
    const model = createTodayModel(harness({ steps }).deps);
    await model.refresh();
    await model.loadStepsIfNeeded();
    await model.loadStepsIfNeeded();
    expect(steps.requestAuthorizationIfNeeded).toHaveBeenCalledTimes(1);
    expect(stepsDisplayValue(model.getSnapshot())).toBe('8421');
  });

  it('the Steps card says "Connect" when access was denied', async () => {
    const steps: StepsReader = {
      requestAuthorizationIfNeeded: jest.fn(async () => false),
      todayStepCount: jest.fn(async () => 0),
    };
    const model = createTodayModel(harness({ steps }).deps);
    await model.refresh();
    await model.loadStepsIfNeeded();
    expect(stepsDisplayValue(model.getSnapshot())).toBe('Connect');
    expect(steps.todayStepCount).not.toHaveBeenCalled();
  });

  it('the week strip is the last seven days, oldest first, ending today; day progress is the elapsed fraction', () => {
    const days = weekStripDays(NOW);
    expect(days).toHaveLength(7);
    expect(dayKey(days[6]!)).toBe('2026-09-12');
    expect(dayKey(days[0]!)).toBe('2026-09-06');
    expect(dayProgress(NOW)).toBeCloseTo(9 / 24, 6);
  });

  it('a disposed model stops reading', async () => {
    const h = harness();
    const model = createTodayModel(h.deps);
    await model.refresh();
    model.dispose();
    h.readers.meals.mockClear();
    h.fire();
    expect(h.readers.meals).not.toHaveBeenCalled();
  });
});
