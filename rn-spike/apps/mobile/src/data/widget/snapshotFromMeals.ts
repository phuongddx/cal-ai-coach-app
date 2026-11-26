import { dayKey, sumMacros, type MealTotalsInput } from '@coachcal/core';

import type { WidgetSnapshot } from './WidgetSnapshotPublisher';

export type WidgetGoals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/** Today's totals as a widget snapshot: only meals eaten on `now`'s local day count. */
export function snapshotFromMeals(
  meals: readonly (MealTotalsInput & { eatenAt: string })[],
  goals: WidgetGoals,
  now: Date,
): WidgetSnapshot {
  const today = dayKey(now);
  const totals = sumMacros(meals.filter((m) => dayKey(new Date(m.eatenAt)) === today));
  return {
    date: today,
    consumedKcal: totals.kcal,
    goalKcal: goals.kcal,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
    proteinGoalG: goals.proteinG,
    carbsGoalG: goals.carbsG,
    fatGoalG: goals.fatG,
  };
}
