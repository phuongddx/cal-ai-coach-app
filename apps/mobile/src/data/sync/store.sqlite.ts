/**
 * The real SQLite `SyncStore` (spec D4), on Drizzle over expo-sqlite.
 *
 * Every port method that the spec calls a transaction is one
 * `db.transaction(...)` — the local write (meal row + outbox operation), each
 * push-batch merge and each pull page (rows + cursor) is all-or-nothing.
 */
import { asc, eq, inArray, max, sql } from 'drizzle-orm';

import type { Meal, MealRecord, PullResponse, SyncOperation } from '@coachcal/api-contract';

import { meals, outbox, syncState } from '../db/schema';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import * as schema from '../db/schema';
import type { LocalMeal, OutboxEntry, SyncStore } from './types';

type Db = ExpoSQLiteDatabase<typeof schema>;

const CURSOR_KEY = 'cursor';

function toRow(meal: Meal, extras: { deleted: boolean; serverVersion: number; acceptedOpId: string | null }) {
  return {
    id: meal.id,
    eatenAt: meal.eatenAt,
    name: meal.name,
    kcal: meal.kcal,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    fiberG: meal.fiberG,
    updatedAt: meal.updatedAt,
    deleted: extras.deleted,
    serverVersion: extras.serverVersion,
    acceptedOpId: extras.acceptedOpId,
  };
}

function fromRow(row: typeof meals.$inferSelect): LocalMeal {
  return {
    id: row.id,
    eatenAt: row.eatenAt,
    name: row.name,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    updatedAt: row.updatedAt,
    deleted: row.deleted,
    serverVersion: row.serverVersion,
    acceptedOpId: row.acceptedOpId,
  };
}

function entryFromRow(row: typeof outbox.$inferSelect): OutboxEntry {
  return {
    op: JSON.parse(row.payload) as SyncOperation,
    attempts: row.attempts,
    state: row.state === 'quarantined' ? 'quarantined' : 'pending',
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}

export function createSqliteSyncStore(db: Db): SyncStore {
  /** MAX(queue_seq)+1 inside the write transaction keeps FIFO across same-ms writes. */
  async function nextQueueSeq(tx: Db): Promise<number> {
    const rows = await tx.select({ highest: max(outbox.queueSeq) }).from(outbox);
    const highest = rows[0]?.highest ?? 0;
    return highest + 1;
  }

  async function enqueue(tx: Db, op: SyncOperation, nowMs: number): Promise<void> {
    await tx.insert(outbox).values({
      opId: op.opId,
      recordId: op.recordId,
      kind: op.kind,
      payload: JSON.stringify(op),
      createdAt: nowMs,
      queueSeq: await nextQueueSeq(tx),
      attempts: 0,
      state: 'pending',
      lastError: null,
    });
  }

  return {
    async recordUpsert(meal, op) {
      const nowMs = op.clientTimestamp;
      await db.transaction(async (tx) => {
        const row = toRow(meal, { deleted: false, serverVersion: 0, acceptedOpId: null });
        await tx.insert(meals).values(row).onConflictDoUpdate({ target: meals.id, set: row });
        await enqueue(tx, op, nowMs);
      });
    },

    async recordDelete(recordId, op) {
      const nowMs = op.clientTimestamp;
      await db.transaction(async (tx) => {
        await tx.delete(meals).where(eq(meals.id, recordId));
        await enqueue(tx, op, nowMs);
      });
    },

    async hasPendingIntent(recordId) {
      const rows = await db.select({ opId: outbox.opId }).from(outbox).where(eq(outbox.recordId, recordId)).limit(1);
      return rows.length > 0;
    },

    async cursor() {
      const rows = await db.select().from(syncState).where(eq(syncState.key, CURSOR_KEY)).limit(1);
      const value = rows[0]?.value;
      return value === undefined ? 0 : Number(value);
    },

    async pendingOperations(limit) {
      const rows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.state, 'pending'))
        .orderBy(asc(outbox.queueSeq))
        .limit(limit);
      return rows.map(entryFromRow);
    },

    async quarantinedOperations() {
      const rows = await db.select().from(outbox).where(eq(outbox.state, 'quarantined')).orderBy(asc(outbox.queueSeq));
      return rows.map(entryFromRow);
    },

    async getMeal(recordId) {
      const rows = await db.select().from(meals).where(eq(meals.id, recordId)).limit(1);
      const row = rows[0];
      return row === undefined ? null : fromRow(row);
    },

    async listMeals() {
      const rows = await db.select().from(meals).orderBy(asc(meals.updatedAt));
      return rows.map(fromRow);
    },

    async outboxCount() {
      const rows = await db.select({ count: sql<number>`count(*)` }).from(outbox);
      return Number(rows[0]?.count ?? 0);
    },

    async applyPushAcks(entries) {
      await db.transaction(async (tx) => {
        for (const { op, record } of entries) {
          await tx.delete(outbox).where(eq(outbox.opId, op.opId));

          const stillPending = await tx
            .select({ opId: outbox.opId })
            .from(outbox)
            .where(eq(outbox.recordId, record.id))
            .limit(1);

          if (stillPending.length > 0) {
            // A newer local edit waits in the outbox: keep its content, only
            // stamp the server's versioning onto the row.
            await tx
              .update(meals)
              .set({ serverVersion: record.serverVersion, acceptedOpId: record.acceptedOpId })
              .where(eq(meals.id, record.id));
            continue;
          }

          if (record.deleted) {
            // A deleted record with no pending operation is removed locally.
            await tx.delete(meals).where(eq(meals.id, record.id));
            continue;
          }

          const row = toRow(record, { deleted: false, serverVersion: record.serverVersion, acceptedOpId: record.acceptedOpId });
          await tx.insert(meals).values(row).onConflictDoUpdate({ target: meals.id, set: row });
        }
      });
    },

    async applyPullPage(rows: PullResponse['rows'], newCursor: number) {
      await db.transaction(async (tx) => {
        for (const { record } of rows) {
          const pending = await tx
            .select({ opId: outbox.opId })
            .from(outbox)
            .where(eq(outbox.recordId, record.id))
            .limit(1);
          if (pending.length > 0) continue; // pending local intent: skip

          if (record.deleted) {
            await tx.delete(meals).where(eq(meals.id, record.id));
            continue;
          }

          const row = toRow(record, { deleted: false, serverVersion: record.serverVersion, acceptedOpId: record.acceptedOpId });
          await tx.insert(meals).values(row).onConflictDoUpdate({ target: meals.id, set: row });
        }
        await tx
          .insert(syncState)
          .values({ key: CURSOR_KEY, value: String(newCursor) })
          .onConflictDoUpdate({ target: syncState.key, set: { value: String(newCursor) } });
      });
    },

    async markAttempts(opIds, lastError) {
      if (opIds.length === 0) return;
      await db
        .update(outbox)
        .set({ attempts: sql`${outbox.attempts} + 1`, lastError })
        .where(inArray(outbox.opId, opIds));
    },

    async quarantine(opIds, lastError) {
      if (opIds.length === 0) return;
      await db.update(outbox).set({ state: 'quarantined', lastError }).where(inArray(outbox.opId, opIds));
    },

    async reset() {
      await db.transaction(async (tx) => {
        await tx.delete(meals);
        await tx.delete(outbox);
        await tx.delete(syncState);
      });
    },
  };
}

/** Shape of a `meals` table row (exported for tests and the console). */
export type MealRow = typeof meals.$inferSelect;
export type MealRecordRow = MealRecord;
