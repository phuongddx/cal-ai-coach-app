/**
 * In-memory `SyncStore` for the engine Jest tests (spec Testing: engine
 * against an in-memory store and a fake transport — no React Native).
 *
 * The multi-step port methods (`applyPushAcks`, `applyPullPage`) are atomic:
 * they mutate a staged copy and swap it in at the end, so a test hook that
 * throws mid-application behaves like a rolled-back transaction.
 */
import type { Meal, MealRecord, PullResponse, SyncOperation } from '@coachcal/api-contract';

import type { LocalMeal, OutboxEntry, OutboxState, SyncStore } from './types';

type State = {
  mealRows: Map<string, LocalMeal>;
  outboxRows: Map<string, { op: SyncOperation; attempts: number; state: OutboxState; lastError: string | null; createdAt: number; queueSeq: number }>;
  cursor: number;
};

export type InMemorySyncStoreOptions = {
  /** When set, applying a pull row for this record id throws mid-page (rollback test). */
  failPullRecordId?: string;
};

export function createInMemorySyncStore(options: InMemorySyncStoreOptions = {}): SyncStore & { state: State } {
  const state: State = {
    mealRows: new Map(),
    outboxRows: new Map(),
    cursor: 0,
  };

  let queueCounter = 0;

  const clone = (): State => ({
    mealRows: new Map(state.mealRows),
    outboxRows: new Map(state.outboxRows),
    cursor: state.cursor,
  });

  const commit = (next: State): void => {
    state.mealRows = next.mealRows;
    state.outboxRows = next.outboxRows;
    state.cursor = next.cursor;
  };

  const enqueue = (next: State, op: SyncOperation): void => {
    queueCounter += 1;
    next.outboxRows.set(op.opId, {
      op,
      attempts: 0,
      state: 'pending',
      lastError: null,
      createdAt: op.clientTimestamp,
      queueSeq: queueCounter,
    });
  };

  const upsertMeal = (next: State, record: MealRecord): void => {
    next.mealRows.set(record.id, {
      id: record.id,
      eatenAt: record.eatenAt,
      name: record.name,
      kcal: record.kcal,
      proteinG: record.proteinG,
      carbsG: record.carbsG,
      fatG: record.fatG,
      fiberG: record.fiberG,
      updatedAt: record.updatedAt,
      deleted: record.deleted,
      serverVersion: record.serverVersion,
      acceptedOpId: record.acceptedOpId,
    });
  };

  const toLocal = (meal: Meal): LocalMeal => ({ ...meal, deleted: false, serverVersion: 0, acceptedOpId: null });

  return {
    state,

    async recordUpsert(meal, op) {
      const next = clone();
      next.mealRows.set(meal.id, toLocal(meal));
      enqueue(next, op);
      commit(next);
    },

    async recordDelete(recordId, op) {
      const next = clone();
      next.mealRows.delete(recordId);
      enqueue(next, op);
      commit(next);
    },

    async hasPendingIntent(recordId) {
      for (const row of state.outboxRows.values()) {
        if (row.op.recordId === recordId) return true;
      }
      return false;
    },

    async cursor() {
      return state.cursor;
    },

    async pendingOperations(limit) {
      const pending = [...state.outboxRows.values()]
        .filter((row) => row.state === 'pending')
        .sort((a, b) => a.queueSeq - b.queueSeq)
        .slice(0, limit);
      return pending.map(({ op, attempts, state: rowState, lastError, createdAt }) => ({
        op,
        attempts,
        state: rowState,
        lastError,
        createdAt,
      }));
    },

    async quarantinedOperations() {
      return [...state.outboxRows.values()]
        .filter((row) => row.state === 'quarantined')
        .sort((a, b) => a.queueSeq - b.queueSeq)
        .map(({ op, attempts, state: rowState, lastError, createdAt }) => ({
          op,
          attempts,
          state: rowState,
          lastError,
          createdAt,
        }));
    },

    async getMeal(recordId) {
      return state.mealRows.get(recordId) ?? null;
    },

    async listMeals() {
      return [...state.mealRows.values()].sort((a, b) => a.updatedAt - b.updatedAt);
    },

    async outboxCount() {
      return state.outboxRows.size;
    },

    async applyPushAcks(entries) {
      const next = clone();
      for (const { op, record } of entries) {
        next.outboxRows.delete(op.opId);

        const stillPending = [...next.outboxRows.values()].some((row) => row.op.recordId === record.id);
        if (stillPending) {
          const existing = next.mealRows.get(record.id);
          if (existing) {
            next.mealRows.set(record.id, {
              ...existing,
              serverVersion: record.serverVersion,
              acceptedOpId: record.acceptedOpId,
            });
          }
          continue;
        }
        if (record.deleted) {
          next.mealRows.delete(record.id);
          continue;
        }
        upsertMeal(next, record);
      }
      commit(next);
    },

    async applyPullPage(rows: PullResponse['rows'], newCursor: number) {
      const next = clone();
      for (const { record } of rows) {
        if (options.failPullRecordId === record.id) {
          // Throw mid-page: `commit` never runs, so rows and cursor roll back together.
          throw new Error('simulated crash while applying the pull page');
        }
        const pending = [...next.outboxRows.values()].some((row) => row.op.recordId === record.id);
        if (pending) continue;
        if (record.deleted) {
          next.mealRows.delete(record.id);
          continue;
        }
        upsertMeal(next, record);
      }
      next.cursor = newCursor;
      commit(next);
    },

    async markAttempts(opIds, lastError) {
      for (const opId of opIds) {
        const row = state.outboxRows.get(opId);
        if (row) {
          row.attempts += 1;
          row.lastError = lastError;
        }
      }
    },

    async quarantine(opIds, lastError) {
      for (const opId of opIds) {
        const row = state.outboxRows.get(opId);
        if (row) {
          row.state = 'quarantined';
          row.lastError = lastError;
        }
      }
    },

    async reset() {
      state.mealRows.clear();
      state.outboxRows.clear();
      state.cursor = 0;
      queueCounter = 0;
    },
  };
}
