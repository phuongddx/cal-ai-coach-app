import { sumMacros } from '@coachcal/core';

import { seedFixtureMeals } from '../features/ember/emberStore';
import { registerSpikeAction } from './registry';
import type { SpikeAction } from './types';

/** T1: the fixture-backed `seed` action. T6 replaces its body with the SQLite repository seed. */
export const seedAction: SpikeAction = {
  name: 'seed',
  item: 'ui',
  title: 'Seed fixture meals',
  run: (ctx) => {
    const meals = seedFixtureMeals(new Date());
    const totals = sumMacros(meals);
    ctx.log('seeded', { meals: meals.length, ...totals });
    return { status: 'ok', summary: `seeded ${meals.length} meals, ${totals.kcal} kcal`, data: { meals: meals.map((m) => m.id), totals } };
  },
};

let registered = false;

/** Idempotent; called once from the root layout. */
export function registerBuiltinSpikeActions(): void {
  if (registered) return;
  registered = true;
  registerSpikeAction(seedAction);
}
