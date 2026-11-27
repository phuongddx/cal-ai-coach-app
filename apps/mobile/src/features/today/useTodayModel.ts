import { useSyncExternalStore } from 'react';

import type { TodayModel, TodaySnapshot } from './todayModel';

/** The model's snapshot as React state; the snapshot object is replaced on change, so it is stable between reads. */
export function useTodaySnapshot(model: TodayModel): TodaySnapshot {
  return useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
}
