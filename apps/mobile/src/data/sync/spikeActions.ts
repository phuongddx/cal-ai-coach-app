/**
 * Spike console actions for item 4 (spec D4/D5), typed with the frozen
 * `SpikeAction` shape from `src/spike/types.ts`. They call the real
 * repository and engine, so on a device `add-meal` writes SQLite and the
 * outbox. T6 registers them; the exact registration lines are in
 * docs/findings/T3-sync.md.
 *
 * Fixture ids are deterministic so curl scripts can address the same meals:
 * A = aaaa…, B = bbbb…, C = cccc….
 */
import type { SpikeAction, SpikeActionResult } from '../../spike/types';
import { getSyncRuntime } from './runtime';

export const MEAL_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const MEAL_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const MEAL_C_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Today at the given local time, as ISO-8601. */
const eatenAtToday = (hours: number, minutes: number): string => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

const fixtureA = () => ({
  id: MEAL_A_ID,
  name: 'Overnight oats',
  kcal: 320,
  proteinG: 12,
  carbsG: 45,
  fatG: 9,
  fiberG: 6,
  eatenAt: eatenAtToday(8, 0),
});

const fixtureB = () => ({
  id: MEAL_B_ID,
  name: 'Protein shake',
  kcal: 210,
  proteinG: 20,
  carbsG: 24,
  fatG: 4,
  fiberG: 2,
  eatenAt: eatenAtToday(16, 0),
});

const fixtureC = () => ({
  id: MEAL_C_ID,
  name: 'Chicken rice bowl',
  kcal: 624,
  proteinG: 38,
  carbsG: 70,
  fatG: 18,
  fiberG: 4,
  eatenAt: eatenAtToday(12, 40),
});

const ok = (summary: string, data?: Record<string, unknown>): SpikeActionResult => ({
  status: 'ok',
  summary,
  ...(data === undefined ? {} : { data }),
});

const error = (summary: string, data?: Record<string, unknown>): SpikeActionResult => ({
  status: 'error',
  summary,
  ...(data === undefined ? {} : { data }),
});

export const seedSpikeAction: SpikeAction = {
  name: 'seed',
  item: 'sync',
  title: 'Seed meals A and C',
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      const a = await runtime.repository.addMeal(fixtureA());
      const c = await runtime.repository.addMeal(fixtureC());
      const outbox = await runtime.store.outboxCount();
      ctx.log('seed', { a: a.id, c: c.id, outbox });
      return ok(`Seeded A (${a.name}) and C (${c.name}); outbox = ${outbox}`, { a: a.id, c: c.id, outbox });
    } catch (cause) {
      ctx.log('seed-failed', { message: String(cause) });
      return error(`Seed failed: ${String(cause)}`);
    }
  },
};

export const addMealSpikeAction: SpikeAction = {
  name: 'add-meal',
  item: 'sync',
  title: 'Add meal B',
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      const meal = await runtime.repository.addMeal(fixtureB());
      const outbox = await runtime.store.outboxCount();
      ctx.log('add-meal', { id: meal.id, outbox, pending: await runtime.store.hasPendingIntent(meal.id) });
      return ok(`Added B (${meal.name}, ${meal.kcal} kcal); outbox = ${outbox}`, { id: meal.id, outbox });
    } catch (cause) {
      ctx.log('add-meal-failed', { message: String(cause) });
      return error(`Add-meal failed: ${String(cause)}`);
    }
  },
};

export const editMealSpikeAction: SpikeAction = {
  name: 'edit-meal',
  item: 'sync',
  title: "Edit meal A (kcal -> 450)",
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      const meal = await runtime.repository.editMeal(MEAL_A_ID, { kcal: 450 });
      const outbox = await runtime.store.outboxCount();
      ctx.log('edit-meal', { id: meal.id, kcal: meal.kcal, updatedAt: meal.updatedAt, outbox });
      return ok(`Edited A to ${meal.kcal} kcal; outbox = ${outbox}`, { id: meal.id, kcal: meal.kcal, updatedAt: meal.updatedAt });
    } catch (cause) {
      ctx.log('edit-meal-failed', { message: String(cause) });
      return error(`Edit-meal failed (seed first?): ${String(cause)}`);
    }
  },
};

export const deleteMealSpikeAction: SpikeAction = {
  name: 'delete-meal',
  item: 'sync',
  title: 'Delete meal C',
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      await runtime.repository.deleteMeal(MEAL_C_ID);
      const outbox = await runtime.store.outboxCount();
      ctx.log('delete-meal', { id: MEAL_C_ID, outbox });
      return ok(`Deleted C (tombstone queued); outbox = ${outbox}`, { id: MEAL_C_ID, outbox });
    } catch (cause) {
      ctx.log('delete-meal-failed', { message: String(cause) });
      return error(`Delete-meal failed: ${String(cause)}`);
    }
  },
};

export const syncSpikeAction: SpikeAction = {
  name: 'sync',
  item: 'sync',
  title: 'Sync now',
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      ctx.log('sync-started', { forcedOffline: runtime.engine.isForcedOffline() });
      const result = await runtime.engine.sync();
      const summary = {
        status: result.status,
        pushed: result.pushed,
        pulled: result.pulled,
        outbox: await runtime.store.outboxCount(),
        cursor: await runtime.store.cursor(),
        quarantined: (await runtime.store.quarantinedOperations()).length,
        detail: result.detail ?? null,
      };
      ctx.log('sync-finished', summary);
      return {
        status: result.status === 'synced' ? 'ok' : 'partial',
        summary: `Sync ${result.status}: pushed ${result.pushed}, pulled ${result.pulled}, outbox = ${summary.outbox}, cursor = ${summary.cursor}`,
        data: summary,
      };
    } catch (cause) {
      ctx.log('sync-failed', { message: String(cause) });
      return error(`Sync failed: ${String(cause)}`);
    }
  },
};

export const forceOfflineSpikeAction: SpikeAction = {
  name: 'force-offline',
  item: 'sync',
  title: 'Force offline',
  run: async (ctx) => {
    const runtime = await getSyncRuntime();
    runtime.engine.setForcedOffline(true);
    ctx.log('force-offline', { forcedOffline: true });
    return ok('Forced offline: isOnline() = false, the server is untouched');
  },
};

export const forceOnlineSpikeAction: SpikeAction = {
  name: 'force-online',
  item: 'sync',
  title: 'Force online',
  run: async (ctx) => {
    const runtime = await getSyncRuntime();
    runtime.engine.setForcedOffline(false);
    ctx.log('force-online', { forcedOffline: false });
    return ok('Back online: isOnline() follows the network again');
  },
};

export const resetSpikeAction: SpikeAction = {
  name: 'reset',
  item: 'sync',
  title: 'Reset local sync state',
  run: async (ctx) => {
    try {
      const runtime = await getSyncRuntime();
      await runtime.store.reset();
      runtime.engine.setForcedOffline(false);
      ctx.log('reset', { meals: 0, outbox: 0, cursor: 0 });
      return ok('Reset: meals, outbox, cursor and forced-offline cleared');
    } catch (cause) {
      ctx.log('reset-failed', { message: String(cause) });
      return error(`Reset failed: ${String(cause)}`);
    }
  },
};

/** All item-4 actions, in console order. */
export const syncSpikeActions: SpikeAction[] = [
  seedSpikeAction,
  addMealSpikeAction,
  editMealSpikeAction,
  deleteMealSpikeAction,
  syncSpikeAction,
  forceOfflineSpikeAction,
  forceOnlineSpikeAction,
  resetSpikeAction,
];
