import { healthSpikeActions } from '../data/health/spikeActions';
import { syncSpikeActions } from '../data/sync/spikeActions';
import { widgetSpikeAction } from '../data/widget/spikeActions';
import { registerSpikeAction } from './registry';

/**
 * Registers every spike action (spec D5): item 2 widget, item 3 HealthKit, item 4 sync. `seed` is the
 * SQLite one from `syncSpikeActions` (T1's fixture-only seed is gone: Ember reads the repository).
 * Idempotent; called once from the root layout.
 */
let registered = false;

export function registerBuiltinSpikeActions(): void {
  if (registered) return;
  registered = true;
  registerSpikeAction(widgetSpikeAction);
  for (const action of syncSpikeActions) registerSpikeAction(action);
  for (const action of healthSpikeActions) registerSpikeAction(action);
}
