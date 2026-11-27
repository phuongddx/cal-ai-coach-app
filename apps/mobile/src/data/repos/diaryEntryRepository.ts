/**
 * DiaryEntryRepository.swift — the diary mirror rows and their details.
 *
 * `recordUpserts` commits every entry row, its detail row and one pending op
 * per entry in ONE transaction: a mid-batch failure must never leave k-of-n
 * rows behind for a retry to duplicate under fresh ids. `recordTombstone`
 * writes the tombstoned mirror row and its op the same way. Row helpers
 * (`upsertDiaryEntry`, `upsertDiaryEntryDetail`, `insertPendingOp`) are the
 * transaction bodies, exported so the sync store can compose them inside one
 * larger transaction (store.sqlite.ts).
 */
import { eq, sql as sqlTag } from 'drizzle-orm';

import { diaryEntryDetails, diaryEntries, pendingOps } from '../db/schema';
import { fromIso, inTransaction, toIso, type Clock, type IdGenerator, type SqlDb, type SqlTx } from './sqlDb';
import type { PendingOp } from './pendingOp';

export interface DiaryEntry {
  id: string;
  userId: string;
  displayText: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverVersion: number;
  acceptedOpId: string | null;
  serverUpdatedAt: Date;
}

export interface DiaryEntryDetail {
  entryId: string;
  mealSlot: string;
  title: string;
  grams: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  confidence: number | null;
  hiddenFatLikely: boolean;
  source: string | null;
  unresolved: boolean;
  scanId: string | null;
}

/** One mirror row + its detail row (the scan save path). */
export interface EntryDetailUpsert {
  entry: DiaryEntry;
  detail: DiaryEntryDetail | null;
}

export type DiaryEntryRepositoryOptions = {
  /** Runs inside the transaction after the mirror write, before the op insert. */
  transactionHook?: (tx: SqlTx) => Promise<void> | void;
  now?: Date;
};

export type DiaryEntryRepositoryDeps = {
  newId: IdGenerator;
  now: Clock;
};

// ---------------------------------------------------------------------------
// Row helpers — the transaction bodies shared by the repository and the sync
// store. Each takes the handle (database or transaction) it writes through.
// ---------------------------------------------------------------------------

export function entryToRow(entry: DiaryEntry) {
  return {
    id: entry.id,
    userId: entry.userId,
    displayText: entry.displayText,
    createdAt: toIso(entry.createdAt),
    updatedAt: toIso(entry.updatedAt),
    deletedAt: entry.deletedAt === null ? null : toIso(entry.deletedAt),
    serverVersion: entry.serverVersion,
    acceptedOpId: entry.acceptedOpId,
    serverUpdatedAt: toIso(entry.serverUpdatedAt),
  };
}

export function rowToEntry(row: typeof diaryEntries.$inferSelect): DiaryEntry {
  return {
    id: row.id,
    userId: row.userId,
    displayText: row.displayText,
    createdAt: fromIso(row.createdAt),
    updatedAt: fromIso(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : fromIso(row.deletedAt),
    serverVersion: row.serverVersion,
    acceptedOpId: row.acceptedOpId,
    serverUpdatedAt: fromIso(row.serverUpdatedAt),
  };
}

export function detailToRow(detail: DiaryEntryDetail) {
  return { ...detail, entryId: detail.entryId };
}

export function rowToDetail(row: typeof diaryEntryDetails.$inferSelect): DiaryEntryDetail {
  return {
    entryId: row.entryId,
    mealSlot: row.mealSlot,
    title: row.title,
    grams: row.grams,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    confidence: row.confidence,
    hiddenFatLikely: row.hiddenFatLikely,
    source: row.source,
    unresolved: row.unresolved,
    scanId: row.scanId,
  };
}

export async function upsertDiaryEntry(tx: SqlTx, entry: DiaryEntry): Promise<void> {
  const row = entryToRow(entry);
  await tx.insert(diaryEntries).values(row).onConflictDoUpdate({ target: diaryEntries.id, set: row });
}

export async function upsertDiaryEntryDetail(tx: SqlTx, detail: DiaryEntryDetail): Promise<void> {
  const row = detailToRow(detail);
  await tx
    .insert(diaryEntryDetails)
    .values(row)
    .onConflictDoUpdate({ target: diaryEntryDetails.entryId, set: row });
}

export async function insertPendingOp(tx: SqlTx, operation: PendingOp): Promise<void> {
  await tx.insert(pendingOps).values({
    opId: operation.opId,
    tableName: operation.tableName,
    recordId: operation.recordId,
    kind: operation.kind,
    snapshot: operation.snapshot,
    clientTimestamp: toIso(operation.clientTimestamp),
    createdAt: toIso(operation.createdAt),
    dispatchAttempts: operation.dispatchAttempts,
    nextRetryAt: operation.nextRetryAt === null ? null : toIso(operation.nextRetryAt),
    quarantined: operation.quarantined,
  });
}

/** The mirror snapshot the wire contract carries (DiaryEntryRepository.snapshot). */
export function snapshotFor(entry: DiaryEntry): string {
  return JSON.stringify({
    id: entry.id,
    displayText: entry.displayText,
    deletedAt: entry.deletedAt === null ? null : toIso(entry.deletedAt),
    serverVersion: entry.serverVersion,
    acceptedOpId: entry.acceptedOpId,
  });
}

function makeOperation(entry: DiaryEntry, kind: string, now: Date, deps: DiaryEntryRepositoryDeps): PendingOp {
  return {
    opId: deps.newId(),
    tableName: 'diary_entries',
    recordId: entry.id,
    kind,
    snapshot: snapshotFor(entry),
    clientTimestamp: now,
    createdAt: now,
    dispatchAttempts: 0,
    nextRetryAt: null,
    quarantined: false,
  };
}

// ---------------------------------------------------------------------------
// The repository
// ---------------------------------------------------------------------------

export function createDiaryEntryRepository(db: SqlDb, deps: DiaryEntryRepositoryDeps) {
  return {
    /** One mirror row (+ optional hook) + its outbox op in one transaction. */
    async recordUpsert(entry: DiaryEntry, options: DiaryEntryRepositoryOptions = {}): Promise<PendingOp> {
      const now = options.now ?? deps.now();
      const operation = makeOperation(entry, 'upsert', now, deps);
      await inTransaction(db, async (tx) => {
        await upsertDiaryEntry(tx, entry);
        if (options.transactionHook !== undefined) {
          await options.transactionHook(tx);
        }
        await insertPendingOp(tx, operation);
      });
      return operation;
    },

    /**
     * Batch upsert: every entry, its detail row and its outbox op commit or
     * roll back together.
     */
    async recordUpserts(upserts: EntryDetailUpsert[], now: Date): Promise<PendingOp[]> {
      const operations: PendingOp[] = [];
      await inTransaction(db, async (tx) => {
        for (const upsert of upserts) {
          const operation = makeOperation(upsert.entry, 'upsert', now, deps);
          await upsertDiaryEntry(tx, upsert.entry);
          if (upsert.detail !== null) {
            await upsertDiaryEntryDetail(tx, upsert.detail);
          }
          await insertPendingOp(tx, operation);
          operations.push(operation);
        }
      });
      return operations;
    },

    /** Tombstone = tombstoned mirror row + its outbox op, one transaction. */
    async recordTombstone(entry: DiaryEntry, options: DiaryEntryRepositoryOptions = {}): Promise<PendingOp> {
      const now = options.now ?? deps.now();
      const tombstoned: DiaryEntry = {
        id: entry.id,
        userId: entry.userId,
        displayText: entry.displayText,
        createdAt: entry.createdAt,
        updatedAt: now,
        deletedAt: entry.deletedAt ?? now,
        serverVersion: entry.serverVersion,
        acceptedOpId: entry.acceptedOpId,
        serverUpdatedAt: entry.serverUpdatedAt,
      };
      const operation = makeOperation(tombstoned, 'tombstone', now, deps);
      await inTransaction(db, async (tx) => {
        await upsertDiaryEntry(tx, tombstoned);
        if (options.transactionHook !== undefined) {
          await options.transactionHook(tx);
        }
        await insertPendingOp(tx, operation);
      });
      return operation;
    },
  };
}

export type DiaryEntryRepository = ReturnType<typeof createDiaryEntryRepository>;

/** Direct row reads the tests and stores use (GRDB's fetchOne(key:)). */
export async function fetchDiaryEntry(db: SqlDb, id: string): Promise<DiaryEntry | null> {
  const rows = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id)).limit(1);
  return rows[0] === undefined ? null : rowToEntry(rows[0]);
}

export async function fetchDiaryEntryDetail(db: SqlDb, entryId: string): Promise<DiaryEntryDetail | null> {
  const rows = await db.select().from(diaryEntryDetails).where(eq(diaryEntryDetails.entryId, entryId)).limit(1);
  return rows[0] === undefined ? null : rowToDetail(rows[0]);
}

export async function fetchPendingOp(db: SqlDb, opId: string): Promise<PendingOp | null> {
  const rows = await db.select().from(pendingOps).where(eq(pendingOps.opId, opId)).limit(1);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    opId: row.opId,
    tableName: row.tableName,
    recordId: row.recordId,
    kind: row.kind,
    snapshot: row.snapshot,
    clientTimestamp: fromIso(row.clientTimestamp),
    createdAt: fromIso(row.createdAt),
    dispatchAttempts: row.dispatchAttempts,
    nextRetryAt: row.nextRetryAt === null ? null : fromIso(row.nextRetryAt),
    quarantined: row.quarantined,
  };
}

export async function countRows(db: SqlDb, table: 'diary_entries' | 'diary_entry_details' | 'pending_ops'): Promise<number> {
  const rows = await db.all<{ count: number }>(sqlTag.raw(`SELECT COUNT(*) AS count FROM ${table}`));
  return Number(rows[0]?.count ?? 0);
}
