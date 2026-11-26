/**
 * Spike console actions for item 3, HealthKit (spec D5, plan T4).
 *
 * Typed with the frozen `SpikeAction` from `src/spike/types.ts` (T4 cannot edit
 * `src/spike/**`; the integration task registers these — the exact lines are in
 * `docs/findings/T4-healthkit.md`).
 */

import type {
  SpikeAction,
  SpikeActionContext,
  SpikeActionResult,
} from '../../spike/types';
import {
  deleteMealFromHealth,
  readMealsFromHealth,
  requestMealAuthorization,
  saveMealToHealth,
  type HealthMealError,
} from './healthKitMeals';
import { dayKeyOf, fixtureMeal } from './mealToHealthKit';

function errorResult(error: HealthMealError): SpikeActionResult {
  return {
    status: 'error',
    summary: `${error.code}: ${error.message}`,
    data: { code: error.code },
  };
}

export const healthRequestAction: SpikeAction = {
  name: 'health-request',
  item: 'health',
  title: 'Request Health authorization',
  run: async (ctx: SpikeActionContext): Promise<SpikeActionResult> => {
    const result = await requestMealAuthorization();
    ctx.log('health-request', result.ok ? result.value : { code: result.error.code });
    if (!result.ok) return errorResult(result.error);
    return {
      status: 'ok',
      summary: 'Health authorization sheet completed (grant state re-checked per call)',
      data: result.value,
    };
  },
};

export const healthSaveAction: SpikeAction = {
  name: 'health-save',
  item: 'health',
  title: 'Save fixture meal to Health',
  run: async (ctx: SpikeActionContext): Promise<SpikeActionResult> => {
    const meal = fixtureMeal();
    const result = await saveMealToHealth(meal);
    ctx.log('health-save', result.ok ? result.value : { code: result.error.code });
    if (!result.ok) return errorResult(result.error);
    return {
      status: 'ok',
      summary: result.value.saved
        ? `Saved ${meal.name} (${meal.kcal} kcal) to Health`
        : `Already in Health (retry, no double save)`,
      data: { meal: meal.name, kcal: meal.kcal, ...result.value },
    };
  },
};

export const healthReadAction: SpikeAction = {
  name: 'health-read',
  item: 'health',
  title: 'Read today’s meals from Health',
  run: async (ctx: SpikeActionContext): Promise<SpikeActionResult> => {
    const dayKey = dayKeyOf(new Date());
    const result = await readMealsFromHealth(dayKey);
    ctx.log('health-read', result.ok ? { dayKey, meals: result.value } : { code: result.error.code });
    if (!result.ok) return errorResult(result.error);
    return {
      status: 'ok',
      summary: `Read ${result.value.length} meal(s) from Health for ${dayKey}`,
      data: { dayKey, meals: result.value },
    };
  },
};

export const healthDeleteAction: SpikeAction = {
  name: 'health-delete',
  item: 'health',
  title: 'Delete fixture meal from Health',
  run: async (ctx: SpikeActionContext): Promise<SpikeActionResult> => {
    const meal = fixtureMeal();
    const result = await deleteMealFromHealth(meal);
    ctx.log('health-delete', result.ok ? result.value : { code: result.error.code });
    if (!result.ok) return errorResult(result.error);
    return {
      status: 'ok',
      summary: `Deleted ${result.value.deleted} correlation(s) and ${result.value.deletedSamples} sample(s) for ${meal.name}`,
      data: result.value,
    };
  },
};

/** All four actions as one list — the registration lines for T6 are in the findings file. */
export const healthSpikeActions: readonly SpikeAction[] = [
  healthRequestAction,
  healthSaveAction,
  healthReadAction,
  healthDeleteAction,
];
