/**
 * The snapshot read of DiaryDayModel.startObservation's ValueObservation —
 * one query over the live-diary join plus the target and the day's exercise
 * rows. The model receives this loader through its constructor; the route file
 * builds it over the real handle, Jest over sql.js.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails, pendingOps } from '../../data/db/schema';
import {
  entryToRow,
  rowToDetail,
  rowToEntry,
  snapshotFor,
  type DiaryEntry,
  type DiaryEntryDetail,
} from '../../data/repos/diaryEntryRepository';
import { fromIso, inTransaction, toIso, type SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository, UserTarget } from '../../data/repos/targetRepository';
import { rowToExerciseLog, type TrackingRepository } from '../../data/repos/trackingRepository';

import { SLOT_ORDER } from './diaryMath';

/** DiaryDayModel.FoodItem — one live diary row of the day. */
export type DiaryDayItem = {
  id: string;
  title: string;
  mealSlot: string;
  kcal: number | null;
  grams: number | null;
  confidence: number | null;
  /** The detail payload's source ('scan' | 'manual' | 'relog' | 'cache'), for the row caption. */
  source: string | null;
  isSynced: boolean;
  loggedAt: Date;
  /** The full mirror row, so the delete path can tombstone without a re-read. */
  entry: DiaryEntry;
  /** The full detail row, so the edit sheet can rewrite grams and kcal in one batch. */
  detail: DiaryEntryDetail;
};

export type DiaryDaySection = { slot: string; items: DiaryDayItem[] };

export type DiaryDayExercise = {
  id: string;
  type: string;
  durationMin: number;
  kcalBurned: number | null;
};

export type DiaryDaySnapshotData = {
  target: UserTarget | null;
  sections: DiaryDaySection[];
  exercises: DiaryDayExercise[];
};

export type DiaryDayLoaderDeps = {
  db: SqlDb;
  targets: TargetRepository;
  tracking: TrackingRepository;
  ownerId: string;
};

export function createDiaryDayLoader(
  deps: DiaryDayLoaderDeps,
): (dayKeyString: string) => Promise<DiaryDaySnapshotData> {
  return async (dayKeyString: string) => {
    const [target, rows, exercises] = await Promise.all([
      deps.targets.activeTarget(deps.ownerId),
      deps.db
        .select({ entry: diaryEntries, detail: diaryEntryDetails })
        .from(diaryEntries)
        .innerJoin(diaryEntryDetails, eq(diaryEntryDetails.entryId, diaryEntries.id))
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            eq(diaryEntries.userId, deps.ownerId),
            // The day grouping follows the user's LOCAL calendar day (WR-02/CR-02).
            sql`date(${diaryEntries.createdAt}, 'localtime') = ${dayKeyString}`,
          ),
        )
        .orderBy(asc(diaryEntries.createdAt)),
      (async () => rowToExerciseRows(await deps.tracking.exercises(dayKeyString)))(),
    ]);

    const bySlot = new Map<string, DiaryDayItem[]>();
    for (const row of rows) {
      const entry = rowToEntry(row.entry);
      const item: DiaryDayItem = {
        id: entry.id,
        title: row.detail.title,
        mealSlot: row.detail.mealSlot,
        kcal: row.detail.kcal,
        grams: row.detail.grams,
        confidence: row.detail.confidence,
        source: row.detail.source,
        isSynced: entry.acceptedOpId !== null,
        loggedAt: entry.createdAt,
        entry,
        detail: rowToDetail(row.detail),
      };
      const slotItems = bySlot.get(item.mealSlot) ?? [];
      slotItems.push(item);
      bySlot.set(item.mealSlot, slotItems);
    }

    const sections: DiaryDaySection[] = SLOT_ORDER.map((slot) => ({
      slot,
      items: bySlot.get(slot) ?? [],
    }));

    return { target, sections, exercises };
  };
}

type ExerciseRow = {
  id: string;
  exerciseType: string;
  durationMin: number;
  kcalBurned: number | null;
};

function rowToExerciseRows(rows: ExerciseRow[]): DiaryDayExercise[] {
  return rows.map((row) => ({
    id: row.id,
    type: row.exerciseType,
    durationMin: row.durationMin,
    kcalBurned: row.kcalBurned,
  }));
}

/**
 * The undo seam (DY-08, the d-deleted frames; the second correction's design,
 * the owner's): an undo is ONE write, the same for the delete's and for the
 * edit's undo. In ONE transaction it (a) deletes every pending op of the
 * record — the tombstone, or the edit's upsert, whatever waits; (b) writes
 * the mirror row of the restored entry with `updatedAt` = the time of the
 * undo, strictly later than the time of the op it replaces (with a clock
 * that stands still, one millisecond later); (c) writes the detail row; and
 * (d) inserts exactly ONE upsert op stamped with that same time. There is NO
 * branch that restores a row with zero ops: whichever state the sync engine
 * is in — the op unread, the push in flight, the push acknowledged — the
 * record ends with a pending upsert whose `updatedAt` beats anything the
 * server may hold.
 */
export type UndoRecordArgs = {
  entryId: string;
  entry: DiaryEntry;
  detail: DiaryEntryDetail;
  now: Date;
  newId: () => string;
};

export async function undoRecordWithOps(db: SqlDb, args: UndoRecordArgs): Promise<void> {
  await inTransaction(db, async (tx) => {
    const pending = await tx
      .select({ opId: pendingOps.opId, clientTimestamp: pendingOps.clientTimestamp })
      .from(pendingOps)
      .where(eq(pendingOps.recordId, args.entryId));
    const pendingTimes = pending.map((row) => fromIso(String(row.clientTimestamp)).getTime());
    // Strictly later than everything it replaces (the owner's one-millisecond
    // rule for a clock that stands still).
    const undoTime = new Date(Math.max(args.now.getTime(), args.entry.updatedAt.getTime(), ...pendingTimes, 0) + 1);
    if (pending.length > 0) {
      await tx.delete(pendingOps).where(eq(pendingOps.recordId, args.entryId));
    }
    const restored: DiaryEntry = { ...args.entry, updatedAt: undoTime };
    const mirrorRow = entryToRow(restored);
    await tx
      .insert(diaryEntries)
      .values(mirrorRow)
      .onConflictDoUpdate({ target: diaryEntries.id, set: mirrorRow });
    await tx
      .insert(diaryEntryDetails)
      .values({ ...args.detail, ...detailToDetailRow(args.detail) })
      .onConflictDoUpdate({
        target: diaryEntryDetails.entryId,
        set: { ...detailToDetailRow(args.detail) },
      });
    await tx.insert(pendingOps).values({
      opId: args.newId(),
      tableName: 'diary_entries',
      recordId: args.entryId,
      kind: 'upsert',
      snapshot: snapshotFor(restored),
      clientTimestamp: toIso(undoTime),
      createdAt: toIso(args.now),
      dispatchAttempts: 0,
      nextRetryAt: null,
      quarantined: false,
    });
  });
}

function detailToDetailRow(detail: DiaryEntryDetail) {
  return {
    mealSlot: detail.mealSlot,
    title: detail.title,
    grams: detail.grams,
    kcal: detail.kcal,
    proteinG: detail.proteinG,
    carbsG: detail.carbsG,
    fatG: detail.fatG,
    fiberG: detail.fiberG,
    confidence: detail.confidence,
    hiddenFatLikely: detail.hiddenFatLikely,
    source: detail.source,
    unresolved: detail.unresolved,
    scanId: detail.scanId,
  };
}
