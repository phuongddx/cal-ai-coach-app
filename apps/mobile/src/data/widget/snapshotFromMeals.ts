import { dayKey, kcalLeft, sumMacros } from '@coachcal/core';

import type { MealTotalsInput, WidgetSnapshot } from '@coachcal/core';

import type { CaloriesWidgetProps } from '../../widgets/CaloriesWidget';

export type WidgetGoals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * The spike widget props (the publisher's shape) carrying the Swift
 * `WidgetSnapshot` fields alongside — the U-10 alignment step. The full flip
 * of the props type to the Swift shape belongs to U-43 (it owns the
 * publisher, the App Group store and the widget runtime); the field-by-field
 * differences are listed in docs/rn-migration/findings/U-10.md.
 */
export type SnapshotFromMeals = CaloriesWidgetProps & WidgetSnapshot;

/** Today's totals as a widget snapshot: only meals eaten on `now`'s local day count. */
export function snapshotFromMeals(
  meals: readonly (MealTotalsInput & { eatenAt: string })[],
  goals: WidgetGoals,
  now: Date,
  edSafeMode = false,
): SnapshotFromMeals {
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
    // The Swift WidgetSnapshot fields (WidgetSnapshot.swift): remaining kcal
    // never below zero, the ED-Safe channel, and the publish instant.
    caloriesRemaining: kcalLeft(goals.kcal, totals.kcal),
    edSafeMode,
    updatedAt: now.toISOString(),
  };
}
