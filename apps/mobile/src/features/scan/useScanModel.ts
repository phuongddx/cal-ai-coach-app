/** Subscribes a screen to the scan model's immutable state snapshots. */
import { useSyncExternalStore } from 'react';

import type { ScanModel } from './scanModel';
import type { ScanState } from './scanTypes';

export function useScanState(model: ScanModel): ScanState {
  return useSyncExternalStore(model.subscribe, model.getState);
}
