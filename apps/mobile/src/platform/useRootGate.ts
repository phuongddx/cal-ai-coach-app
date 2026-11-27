import { useSyncExternalStore } from 'react';

import type { RootGateRoute } from './rootGate';
import type { RootController } from './rootController';

/** The gate's route for a component; re-renders when the state under it changes. */
export function useRootGateRoute(controller: RootController): RootGateRoute {
  return useSyncExternalStore(controller.subscribe, controller.getRoute, controller.getRoute);
}
