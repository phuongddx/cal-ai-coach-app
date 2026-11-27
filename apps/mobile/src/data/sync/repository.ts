/**
 * The meal repository (spec D4): every local write is one transaction in the
 * store — the meal row plus its outbox operation — then `onLocalWrite()` fires
 * so the sync trigger can debounce-sync 500 ms later.
 */
import type { Meal, SyncOperation } from '@coachcal/api-contract';

import type { LocalMeal, SyncStore } from './types';

export type MealInput = {
  /** Deterministic ids for fixtures (the spike console); generated when omitted. */
  id?: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** ISO-8601; defaults to the injected clock. */
  eatenAt?: string;
};

export type RepositoryDeps = {
  store: SyncStore;
  now: () => number;
  newId: () => string;
  /** Called after every successful local write (the 500 ms sync trigger). */
  onLocalWrite?: () => void;
};

export interface MealRepository {
  addMeal(input: MealInput): Promise<LocalMeal>;
  editMeal(recordId: string, patch: Partial<MealInput>): Promise<LocalMeal>;
  deleteMeal(recordId: string): Promise<void>;
  listMeals(): Promise<LocalMeal[]>;
  getMeal(recordId: string): Promise<LocalMeal | null>;
  hasPendingIntent(recordId: string): Promise<boolean>;
  reset(): Promise<void>;
}

export function createMealRepository(deps: RepositoryDeps): MealRepository {
  const { store, now, newId } = deps;

  const buildUpsertOp = (meal: Meal): SyncOperation => ({
    opId: newId(),
    recordId: meal.id,
    kind: 'upsert',
    meal,
    clientTimestamp: now(),
  });

  return {
    async addMeal(input) {
      const meal: Meal = {
        id: input.id ?? newId(),
        eatenAt: input.eatenAt ?? new Date(now()).toISOString(),
        name: input.name,
        kcal: input.kcal,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        fiberG: input.fiberG,
        updatedAt: now(),
      };
      await store.recordUpsert(meal, buildUpsertOp(meal));
      deps.onLocalWrite?.();
      return { ...meal, deleted: false, serverVersion: 0, acceptedOpId: null };
    },

    async editMeal(recordId, patch) {
      const existing = await store.getMeal(recordId);
      if (existing === null) {
        throw new Error(`editMeal: unknown meal ${recordId}`);
      }
      const meal: Meal = {
        id: existing.id,
        eatenAt: patch.eatenAt ?? existing.eatenAt,
        name: patch.name ?? existing.name,
        kcal: patch.kcal ?? existing.kcal,
        proteinG: patch.proteinG ?? existing.proteinG,
        carbsG: patch.carbsG ?? existing.carbsG,
        fatG: patch.fatG ?? existing.fatG,
        fiberG: patch.fiberG ?? existing.fiberG,
        // The client wall clock at THIS edit — the LWW clock.
        updatedAt: now(),
      };
      await store.recordUpsert(meal, buildUpsertOp(meal));
      deps.onLocalWrite?.();
      return { ...meal, deleted: false, serverVersion: existing.serverVersion, acceptedOpId: existing.acceptedOpId };
    },

    async deleteMeal(recordId) {
      const op: SyncOperation = {
        opId: newId(),
        recordId,
        kind: 'tombstone',
        clientTimestamp: now(),
      };
      await store.recordDelete(recordId, op);
      deps.onLocalWrite?.();
    },

    listMeals: () => store.listMeals(),
    getMeal: (recordId) => store.getMeal(recordId),
    hasPendingIntent: (recordId) => store.hasPendingIntent(recordId),
    reset: () => store.reset(),
  };
}
