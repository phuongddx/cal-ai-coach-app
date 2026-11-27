/**
 * The real SQLite `SyncStore` (spec D4), on Drizzle over expo-sqlite — now on
 * the Swift tables: `diary_entries` (+ `diary_entry_details`) mirrors, the
 * `pending_ops` outbox and the single-row `sync_state` cursor.
 *
 * - A local write is one transaction: the mirror row (+ its detail row), the
 *   pending op. A delete writes the tombstoned mirror row and queues the
 *   tombstone op.
 * - Push acks run through the sync merge repository's acknowledgement rules
 *   (canonical version bump + op delete) in one transaction.
 * - A pull page runs through the sync merge repository (LWW via
 *   `compareCanonicalVersions`, skips records with pending local intent) and
 *   writes the pulled details rows in the same transaction, then advances the
 *   cursor.
 *
 * The wire shapes stay the contract's meal records (`@coachcal/api-contract`);
 * this file maps between the meal wire shape and the Swift tables. The
 * `SyncStore` interface itself is unchanged, so the engine keeps working.
 */
import { asc, eq, sql } from 'drizzle-orm';

import type { Meal, MealRecord, PullResponse, SyncOperation } from '@coachcal/api-contract';
import type { DiaryEntry, DiaryEntryDetail } from '../repos/diaryEntryRepository';

import { diaryEntryDetails, diaryEntries, pendingOps, syncState } from '../db/schema';
import { entryToRow, rowToEntry, rowToDetail } from '../repos/diaryEntryRepository';
import { applyAcknowledgement, applyPulledRow, enqueueDiaryOp } from '../repos/syncMergeRepository';
import { fromIso, inTransaction, toIso, type SqlDb } from '../repos/sqlDb';
import type { LocalMeal, OutboxEntry, SyncStore } from './types';

type Db = SqlDb;

/**
 * Single-account device: mirror rows carry this owner until the auth unit
 * lands (Swift gets it from the session). The demo user id from
 * SeedDataManager keeps the seed and the sync writes consistent.
 */
const LOCAL_OWNER_ID = 'de000000-0000-4000-8000-000000000001';

/** Wire meals carry no slot; derive the details row's slot from eatenAt. */
function mealSlotFor(eatenAtIso: string): string {
  const hour = new Date(eatenAtIso).getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

function mealToEntry(meal: Meal, extras: { deletedAt: Date | null; serverVersion: number; acceptedOpId: string | null; now: Date }): DiaryEntry {
  return {
    id: meal.id,
    userId: LOCAL_OWNER_ID,
    displayText: meal.name,
    createdAt: new Date(meal.eatenAt),
    updatedAt: new Date(meal.updatedAt),
    deletedAt: extras.deletedAt,
    serverVersion: extras.serverVersion,
    acceptedOpId: extras.acceptedOpId,
    serverUpdatedAt: extras.now,
  };
}

function entryToLocalMeal(entry: DiaryEntry, detail: DiaryEntryDetail | null): LocalMeal {
  return {
    id: entry.id,
    eatenAt: entry.createdAt.toISOString(),
    name: entry.displayText,
    kcal: detail?.kcal ?? 0,
    proteinG: detail?.proteinG ?? 0,
    carbsG: detail?.carbsG ?? 0,
    fatG: detail?.fatG ?? 0,
    fiberG: detail?.fiberG ?? 0,
    updatedAt: entry.updatedAt.getTime(),
    deleted: entry.deletedAt !== null,
    serverVersion: entry.serverVersion,
    acceptedOpId: entry.acceptedOpId,
  };
}

function detailForMeal(meal: Meal, source: string): DiaryEntryDetail {
  return {
    entryId: meal.id,
    mealSlot: mealSlotFor(meal.eatenAt),
    title: meal.name,
    grams: null,
    kcal: meal.kcal,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    fiberG: meal.fiberG,
    confidence: null,
    hiddenFatLikely: false,
    source,
    unresolved: false,
    scanId: null,
  };
}

async function readDetail(tx: Db, entryId: string): Promise<DiaryEntryDetail | null> {
  const rows = await tx.select().from(diaryEntryDetails).where(eq(diaryEntryDetails.entryId, entryId)).limit(1);
  return rows[0] === undefined ? null : rowToDetail(rows[0]);
}

export function createSqliteSyncStore(db: Db): SyncStore {
  return {
    /** Local write = one transaction: mirror row + detail row + pending op. */
    async recordUpsert(meal, op) {
      await inTransaction(db, async (tx) => {
        const at = new Date(op.clientTimestamp);
        const entry = mealToEntry(meal, { deletedAt: null, serverVersion: 0, acceptedOpId: null, now: at });
        await tx.insert(diaryEntries).values(entryToRow(entry)).onConflictDoUpdate({ target: diaryEntries.id, set: entryToRow(entry) });
        await tx
          .insert(diaryEntryDetails)
          .values(detailForMeal(meal, 'local'))
          .onConflictDoUpdate({ target: diaryEntryDetails.entryId, set: detailForMeal(meal, 'local') });
        await enqueueDiaryOp(tx, {
          opId: op.opId,
          recordId: op.recordId,
          kind: op.kind,
          clientTimestamp: at,
          createdAt: at,
          entry,
        });
      });
    },

    /** Local delete = one transaction: tombstone the mirror row, queue the op. */
    async recordDelete(recordId, op) {
      await inTransaction(db, async (tx) => {
        const at = new Date(op.clientTimestamp);
        const rows = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, recordId)).limit(1);
        const existing = rows[0] === undefined ? null : rowToEntry(rows[0]);
        const entry = existing === null
          ? {
              id: recordId,
              userId: LOCAL_OWNER_ID,
              displayText: '',
              createdAt: at,
              updatedAt: at,
              deletedAt: at,
              serverVersion: 0,
              acceptedOpId: null,
              serverUpdatedAt: at,
            }
          : {
              ...existing,
              updatedAt: at,
              deletedAt: existing.deletedAt ?? at,
            };
        await tx.insert(diaryEntries).values(entryToRow(entry)).onConflictDoUpdate({ target: diaryEntries.id, set: entryToRow(entry) });
        await enqueueDiaryOp(tx, {
          opId: op.opId,
          recordId: op.recordId,
          kind: op.kind,
          clientTimestamp: at,
          createdAt: at,
          entry,
        });
      });
    },

    /** "Has pending local intent": a pending_ops row exists for the record id. */
    async hasPendingIntent(recordId) {
      const rows = await db
        .select({ opId: pendingOps.opId })
        .from(pendingOps)
        .where(eq(pendingOps.recordId, recordId))
        .limit(1);
      return rows.length > 0;
    },

    /** The single-row pull cursor. */
    async cursor() {
      const rows = await db.select().from(syncState).where(eq(syncState.id, 1)).limit(1);
      return rows[0]?.pullCursor ?? 0;
    },

    /**
     * FIFO by created_at then op_id, not quarantined — the outbox's due batch
     * (engine batches are already ≤ 50, the Swift cap).
     */
    async pendingOperations(limit) {
      const rows = await db
        .select()
        .from(pendingOps)
        .where(eq(pendingOps.quarantined, false))
        .orderBy(asc(pendingOps.createdAt), asc(pendingOps.opId))
        .limit(limit);
      const entries: OutboxEntry[] = [];
      for (const row of rows) {
        entries.push(await outboxEntryForRow(db, row));
      }
      return entries;
    },

    async quarantinedOperations() {
      const rows = await db
        .select()
        .from(pendingOps)
        .where(eq(pendingOps.quarantined, true))
        .orderBy(asc(pendingOps.createdAt), asc(pendingOps.opId));
      const entries: OutboxEntry[] = [];
      for (const row of rows) {
        entries.push(await outboxEntryForRow(db, row));
      }
      return entries;
    },

    /** The mirror row + its detail row, as the wire LocalMeal. */
    async getMeal(recordId) {
      const rows = await db.select().from(diaryEntries).where(eq(diaryEntries.id, recordId)).limit(1);
      const row = rows[0];
      if (row === undefined) return null;
      return entryToLocalMeal(rowToEntry(row), await readDetail(db, recordId));
    },

    /** All mirror rows, oldest edit first. */
    async listMeals() {
      const rows = await db.select().from(diaryEntries).orderBy(asc(diaryEntries.updatedAt));
      const meals: LocalMeal[] = [];
      for (const row of rows) {
        meals.push(entryToLocalMeal(rowToEntry(row), await readDetail(db, row.id)));
      }
      return meals;
    },

    async outboxCount() {
      const rows = await db.select({ count: sql<number>`count(*)` }).from(pendingOps);
      return Number(rows[0]?.count ?? 0);
    },

    /**
     * Push acks, one transaction, the Swift acknowledgement rules: stamp the
     * acked canonical version onto the mirror row (only when newer) and
     * delete the op; the content itself arrives with the next pull.
     */
    async applyPushAcks(entries) {
      await inTransaction(db, async (tx) => {
        for (const { op, record } of entries) {
          await applyAcknowledgement(tx, {
            opId: op.opId,
            serverVersion: record.serverVersion,
            acceptedOpId: record.acceptedOpId ?? '',
            duplicate: false,
          }, new Date(record.updatedAt));
        }
      });
    },

    /**
     * One pull page, one transaction: the merge repository applies the rows
     * (LWW, pending-intent skip), the pulled detail rows are written in the
     * same transaction, the cursor advances last.
     */
    async applyPullPage(rows: PullResponse['rows'], newCursor: number) {
      await inTransaction(db, async (tx) => {
        for (const { record } of rows) {
          const applied = await applyPulledRow(
            tx,
            {
              table: 'diary_entries',
              recordId: record.id,
              snapshot: {
                id: record.id,
                displayText: record.name,
                deletedAt: record.deleted ? toIso(new Date(record.updatedAt)) : null,
                serverVersion: record.serverVersion,
                acceptedOpId: record.acceptedOpId,
              },
            },
            LOCAL_OWNER_ID,
            new Date(),
          );
          // Details are local-only (I4): write them only for rows the merge
          // actually applied, and only for live content — a tombstone never
          // carries nutrition.
          if (applied && !record.deleted) {
            const detail = detailForMeal(mealFromRecord(record), 'sync');
            await tx
              .insert(diaryEntryDetails)
              .values({ ...detail })
              .onConflictDoUpdate({ target: diaryEntryDetails.entryId, set: { ...detail } });
          }
        }
        const states = await tx.select().from(syncState).where(eq(syncState.id, 1)).limit(1);
        if (states[0] !== undefined) {
          await tx.update(syncState).set({ pullCursor: newCursor }).where(eq(syncState.id, 1));
        }
      });
    },

    /** Failed attempt: bump the attempt counter, retry time stays open. */
    async markAttempts(opIds, lastError) {
      if (opIds.length === 0) return;
      for (const opId of opIds) {
        await db
          .update(pendingOps)
          .set({ dispatchAttempts: sql`${pendingOps.dispatchAttempts} + 1` })
          .where(eq(pendingOps.opId, opId));
      }
      void lastError; // pending_ops has no error column (Swift parity)
    },

    /** Dead letter per op: stays in the table, leaves the due batch. */
    async quarantine(opIds, lastError) {
      if (opIds.length === 0) return;
      for (const opId of opIds) {
        await db
          .update(pendingOps)
          .set({ quarantined: true, dispatchAttempts: sql`${pendingOps.dispatchAttempts} + 1`, nextRetryAt: null })
          .where(eq(pendingOps.opId, opId));
      }
      void lastError;
    },

    /** Empties mirrors, details, pending ops; resets the cursor row. */
    async reset() {
      await inTransaction(db, async (tx) => {
        await tx.delete(diaryEntries);
        await tx.delete(diaryEntryDetails);
        await tx.delete(pendingOps);
        await tx.delete(syncState);
        await tx.insert(syncState).values({ id: 1, pullCursor: 0 });
      });
    },
  };
}

function mealFromRecord(record: MealRecord): Meal {
  return {
    id: record.id,
    eatenAt: record.eatenAt,
    name: record.name,
    kcal: record.kcal,
    proteinG: record.proteinG,
    carbsG: record.carbsG,
    fatG: record.fatG,
    fiberG: record.fiberG,
    updatedAt: record.updatedAt,
  };
}

/**
 * Rebuilds the wire operation from the Swift tables: the op's meal fields
 * come from the mirror row + its detail row (the snapshot column carries the
 * diary snapshot only).
 */
async function outboxEntryForRow(db: Db, row: typeof pendingOps.$inferSelect): Promise<OutboxEntry> {
  const clientTimestamp = fromIso(row.clientTimestamp).getTime();
  const op: SyncOperation =
    row.kind === 'tombstone'
      ? { opId: row.opId, recordId: row.recordId, kind: 'tombstone', clientTimestamp }
      : {
          opId: row.opId,
          recordId: row.recordId,
          kind: 'upsert',
          clientTimestamp,
          meal: await mealForOp(db, row.recordId),
        };
  return {
    op,
    attempts: row.dispatchAttempts,
    state: row.quarantined ? 'quarantined' : 'pending',
    lastError: null,
    createdAt: fromIso(row.createdAt).getTime(),
  };
}

/** The op's meal fields come from the mirror row + its detail row. */
async function mealForOp(db: Db, recordId: string): Promise<Meal> {
  const entries = await db.select().from(diaryEntries).where(eq(diaryEntries.id, recordId)).limit(1);
  const entryRow = entries[0];
  if (entryRow === undefined) {
    // The mirror row is gone (an ack removed it mid-retry): an empty meal
    // keeps the batch shape valid; the server answers duplicate and the op
    // drains on the next ack pass.
    return {
      id: recordId,
      eatenAt: '1970-01-01T00:00:00.000Z',
      name: '',
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      updatedAt: 0,
    };
  }
  const detail = await readDetail(db, recordId);
  const local = entryToLocalMeal(rowToEntry(entryRow), detail);
  return {
    id: local.id,
    eatenAt: local.eatenAt,
    name: local.name,
    kcal: local.kcal,
    proteinG: local.proteinG,
    carbsG: local.carbsG,
    fatG: local.fatG,
    fiberG: local.fiberG,
    updatedAt: local.updatedAt,
  };
}

/** Shape of a `diary_entries` row (exported for tests and the console). */
export type DiaryEntryRow = typeof diaryEntries.$inferSelect;
