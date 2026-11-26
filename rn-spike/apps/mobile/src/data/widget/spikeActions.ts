import type { SpikeAction } from '../../spike/types';
import { localDayKey, publish, type WidgetSnapshot } from './WidgetSnapshotPublisher';

/** Fixture totals for the console button: 1,284 of 2,100 kcal, the numbers in the Ember reference. */
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

export const widgetSpikeAction: SpikeAction = {
  name: 'widget-publish',
  item: 'widget',
  title: 'Publish snapshot',
  run: (ctx) => {
    const snapshot = fixtureSnapshot(new Date());
    const ok = publish(snapshot, { log: ctx.log });
    return ok
      ? {
          status: 'ok',
          summary: `Published ${snapshot.consumedKcal}/${snapshot.goalKcal} kcal for ${snapshot.date} with a midnight entry`,
          data: snapshot,
        }
      : { status: 'error', summary: 'Widget publish failed, see the [spike] log', data: snapshot };
  },
};
