import { snapshotFromMeals } from './snapshotFromMeals';

const goals = { kcal: 2100, proteinG: 130, carbsG: 210, fatG: 70 };
const NOW = new Date(2026, 10, 27, 18, 0, 0);
const meal = (day: number, kcal: number) => ({
  eatenAt: new Date(2026, 10, day, 12, 0, 0).toISOString(),
  kcal,
  proteinG: 10,
  carbsG: 20,
  fatG: 5,
  fiberG: 1,
});

describe('snapshotFromMeals', () => {
  it('sums only the meals eaten today and carries the goals', () => {
    const snapshot = snapshotFromMeals([meal(27, 300), meal(27, 200), meal(26, 999)], goals, NOW);
    expect(snapshot).toEqual({
      date: '2026-11-27',
      consumedKcal: 500,
      goalKcal: 2100,
      proteinG: 20,
      carbsG: 40,
      fatG: 10,
      proteinGoalG: 130,
      carbsGoalG: 210,
      fatGoalG: 70,
    });
  });

  it('is a zeroed snapshot for a day without meals', () => {
    expect(snapshotFromMeals([], goals, NOW)).toMatchObject({ date: '2026-11-27', consumedKcal: 0, proteinG: 0 });
  });
});
