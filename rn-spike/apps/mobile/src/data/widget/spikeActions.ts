import { fixtureTargets } from '../../features/ember/fixture';
import { getEmberState } from '../../features/ember/emberStore';
import type { SpikeAction } from '../../spike/types';
import { snapshotFromMeals } from './snapshotFromMeals';
import { localDayKey, publish, type WidgetSnapshot } from './WidgetSnapshotPublisher';

/** Fixture totals: 1,284 of 2,100 kcal, the numbers in the Ember reference. Kept for tests and the docs. */
export function fixtureSnapshot(now: Date): WidgetSnapshot {
  return {
    date: localDayKey(now),
    consumedKcal: 1284,
    goalKcal: 2100,
    proteinG: 82,
    carbsG: 140,
    fatG: 38,
    proteinGoalG: 130,
    carbsGoalG: 210,
    fatGoalG: 70,
  };
}

/**
 * Publishes what Ember shows right now (today's meals from SQLite). Integration (T6) replaced the
 * fixed 1,284 kcal with the real totals; `&rolloverInSeconds=90` in the deep link moves the
 * midnight entry to 90 s ahead so the day rollover can be watched (T2 findings, section 8).
 */
export const widgetSpikeAction: SpikeAction = {
  name: 'widget-publish',
  item: 'widget',
  title: 'Publish snapshot',
  run: (ctx) => {
    const now = new Date();
    const snapshot = snapshotFromMeals(getEmberState().meals, fixtureTargets, now);
    const seconds = Number(ctx.params.rolloverInSeconds);
    const rolloverAt = Number.isFinite(seconds) && seconds > 0 ? new Date(now.getTime() + seconds * 1000) : undefined;
    const ok = publish(snapshot, { log: ctx.log, rolloverAt });
    const note = rolloverAt ? ` (rollover entry at ${rolloverAt.toISOString()})` : ' with a midnight entry';
    return ok
      ? {
          status: 'ok',
          summary: `Published ${snapshot.consumedKcal}/${snapshot.goalKcal} kcal for ${snapshot.date}${note}`,
          data: { ...snapshot, rolloverAt: rolloverAt?.toISOString() ?? null },
        }
      : { status: 'error', summary: 'Widget publish failed, see the [spike] log', data: snapshot };
  },
};
