import type { MealTotalsInput } from '@coachcal/core';

/** Field names match the contract `Meal` of spec D4 (plus `fiberG`). */
export type FixtureMeal = MealTotalsInput & {
  id: string;
  eatenAt: string; // ISO-8601
  name: string;
  updatedAt: number; // integer ms, the LWW clock
};

/** Spike-only UI extension: the contract `Meal` has no confidence, so SQLite-bound meals simply omit it. */
export type Confidence = 'high' | 'medium' | 'low';
export type EmberMeal = FixtureMeal & { confidence?: Confidence };

export type EmberTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
};

export const fixtureTargets: EmberTargets = { kcal: 2100, proteinG: 130, carbsG: 210, fatG: 70, fiberG: 30 };

function at(now: Date, hour: number, minute: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
}

/**
 * Today's fixture meals, anchored on `now` so they always fall on "today". Totals match the
 * Ember mock: 1,284 kcal eaten, 82 / 140 / 38 / 14 g of protein / carbs / fat / fiber.
 */
export function buildFixtureMeals(now: Date): EmberMeal[] {
  const stamp = now.getTime();
  return [
    {
      id: '3f1c6a52-0b1e-4a6e-9c1d-000000000001',
      eatenAt: at(now, 8, 5).toISOString(),
      name: 'Overnight oats',
      kcal: 410,
      proteinG: 24,
      carbsG: 48,
      fatG: 12,
      fiberG: 7,
      updatedAt: stamp,
      confidence: 'medium',
    },
    {
      id: '3f1c6a52-0b1e-4a6e-9c1d-000000000002',
      eatenAt: at(now, 12, 40).toISOString(),
      name: 'Chicken rice bowl',
      kcal: 624,
      proteinG: 38,
      carbsG: 70,
      fatG: 18,
      fiberG: 5,
      updatedAt: stamp,
      confidence: 'high',
    },
    {
      id: '3f1c6a52-0b1e-4a6e-9c1d-000000000003',
      eatenAt: at(now, 15, 30).toISOString(),
      name: 'Greek yogurt & berries',
      kcal: 250,
      proteinG: 20,
      carbsG: 22,
      fatG: 8,
      fiberG: 2,
      updatedAt: stamp,
      confidence: 'high',
    },
  ];
}
