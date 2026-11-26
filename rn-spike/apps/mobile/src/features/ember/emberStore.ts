import { useSyncExternalStore } from 'react';

import { buildFixtureMeals, type EmberMeal } from './fixture';

/**
 * Tiny external store behind the Ember route: fixture meals now, the SQLite repository at
 * integration (D5). EmberView itself never reads it; the route passes the values in as props.
 */
type EmberState = { meals: EmberMeal[]; isOffline: boolean };

let state: EmberState = { meals: buildFixtureMeals(new Date()), isOffline: false };
const listeners = new Set<() => void>();

function set(next: EmberState) {
  state = next;
  listeners.forEach((l) => l());
}

export function getEmberState(): EmberState {
  return state;
}

export function seedFixtureMeals(now: Date = new Date()): EmberMeal[] {
  const meals = buildFixtureMeals(now);
  set({ ...state, meals });
  return meals;
}

export function setOffline(isOffline: boolean) {
  set({ ...state, isOffline });
}

export function subscribeEmber(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEmberState(): EmberState {
  return useSyncExternalStore(subscribeEmber, getEmberState, getEmberState);
}
