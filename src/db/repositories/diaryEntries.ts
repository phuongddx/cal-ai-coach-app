import { and, eq, isNull } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type {
  ExpoSQLiteDatabase,
  ExpoSQLiteTransaction,
} from 'drizzle-orm/expo-sqlite';

import {
  SyncOperationSchema,
  type DiaryEntrySnapshot,
  type MutationKind,
} from '../../contracts/sync';
import { newId } from '../../lib/uuid';
import {
  diaryEntries,
  pendingOps,
  type DiaryEntry,
  type NewPendingOp,
} from '../schema';

/**
 * The ONLY durable mutation surface for `diary_entries` in Phase 1.
 *
 * Invariant (Plan 01-02): every mutation validates its sync envelope against
 * the shared contract, then — inside ONE SQLite transaction — enqueues exactly
 * one immutable outbox operation AND applies its mirror mutation. A failure at
 * any point rolls back both: no orphan row without durable intent, no durable
 * intent without its row.
 *
 * Ownership: every query predicate and every outbox insert binds `ownerId`
 * (the locally authenticated user). A caller can never read or mutate another
 * owner's rows, and a User B session can never flush User A's queue.
 */

type Schema = Record<string, never>;
type Db = ExpoSQLiteDatabase<Schema>;
type Tx = ExpoSQLiteTransaction<Schema, ExtractTablesWithRelations<Schema>>;

/** Test seam: inject id generation for deterministic failure proofs. */
interface WriteOptions {
  newId?: () => string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(opts?: WriteOptions): string {
  return (opts?.newId ?? newId)();
}

/**
 * Allocates the next per-owner sequence, validates the full sync envelope, and
 * inserts the immutable outbox row. Runs INSIDE the caller's transaction.
 */
function enqueueOperation(
  tx: Tx,
  ownerId: string,
  recordId: string,
  kind: MutationKind,
  snapshot: DiaryEntrySnapshot,
  opts?: WriteOptions
): NewPendingOp {
  const seqRows = tx
    .select({ maxSeq: pendingOps.ownerSeq })
    .from(pendingOps)
    .where(eq(pendingOps.ownerId, ownerId))
    .all();
  const nextSeq =
    seqRows.reduce((acc, row) => Math.max(acc, row.maxSeq), 0) + 1;

  const operation = SyncOperationSchema.parse({
    opId: generateId(opts),
    table: 'diary_entries',
    recordId,
    kind,
    snapshot,
    clientTimestamp: nowIso(),
  });

  const op: NewPendingOp = {
    opId: operation.opId,
    ownerId,
    ownerSeq: nextSeq,
    tableName: operation.table,
    recordId: operation.recordId,
    kind: operation.kind,
    snapshotJson: JSON.stringify(operation.snapshot),
    clientTimestamp: operation.clientTimestamp,
    createdAt: operation.clientTimestamp,
  };
  tx.insert(pendingOps).values(op).run();
  return op;
}

function requireOwnedRow(tx: Tx, ownerId: string, id: string): DiaryEntry {
  const rows = tx
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.id, id), eq(diaryEntries.ownerId, ownerId)))
    .all();
  const row = rows[0];
  if (!row) {
    throw new Error(`Diary entry ${id} not found for owner ${ownerId}`);
  }
  return row;
}

/** Reads back the mutated row after commit; a miss here is an invariant break. */
function requireCommittedRow(db: Db, ownerId: string, id: string): DiaryEntry {
  const row = getDiaryEntry(db, ownerId, id);
  if (!row) {
    throw new Error(
      `Invariant violation: diary entry ${id} missing after committed transaction`
    );
  }
  return row;
}

export function createDiaryEntry(
  db: Db,
  ownerId: string,
  displayText: string,
  opts?: WriteOptions
): DiaryEntry {
  const id = generateId(opts);
  const now = nowIso();

  db.transaction((tx) => {
    const snapshot: DiaryEntrySnapshot = {
      id,
      displayText,
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
    };
    enqueueOperation(tx, ownerId, id, 'upsert', snapshot, opts);
    tx
      .insert(diaryEntries)
      .values({
        id,
        ownerId,
        displayText,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  return requireCommittedRow(db, ownerId, id);
}

export function updateDiaryEntry(
  db: Db,
  ownerId: string,
  id: string,
  displayText: string,
  opts?: WriteOptions
): DiaryEntry {
  db.transaction((tx) => {
    const row = requireOwnedRow(tx, ownerId, id);
    const snapshot: DiaryEntrySnapshot = {
      id,
      displayText,
      deletedAt: row.deletedAt,
      serverVersion: row.serverVersion,
      acceptedOpId: row.acceptedOpId,
    };
    enqueueOperation(tx, ownerId, id, 'upsert', snapshot, opts);
    tx
      .update(diaryEntries)
      .set({ displayText, updatedAt: nowIso() })
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.ownerId, ownerId)))
      .run();
  });

  return requireCommittedRow(db, ownerId, id);
}

export function tombstoneDiaryEntry(
  db: Db,
  ownerId: string,
  id: string,
  opts?: WriteOptions
): DiaryEntry {
  db.transaction((tx) => {
    const row = requireOwnedRow(tx, ownerId, id);
    const deletedAt = nowIso();
    const snapshot: DiaryEntrySnapshot = {
      id,
      displayText: row.displayText,
      deletedAt,
      serverVersion: row.serverVersion,
      acceptedOpId: row.acceptedOpId,
    };
    enqueueOperation(tx, ownerId, id, 'tombstone', snapshot, opts);
    tx
      .update(diaryEntries)
      .set({ deletedAt, updatedAt: nowIso() })
      .where(and(eq(diaryEntries.id, id), eq(diaryEntries.ownerId, ownerId)))
      .run();
  });

  return requireCommittedRow(db, ownerId, id);
}

export function getDiaryEntry(
  db: Db,
  ownerId: string,
  id: string
): DiaryEntry | undefined {
  const rows = db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.id, id), eq(diaryEntries.ownerId, ownerId)))
    .all();
  return rows[0];
}

export function listDiaryEntries(db: Db, ownerId: string): DiaryEntry[] {
  return db
    .select()
    .from(diaryEntries)
    .where(
      and(eq(diaryEntries.ownerId, ownerId), isNull(diaryEntries.deletedAt))
    )
    .all();
}
