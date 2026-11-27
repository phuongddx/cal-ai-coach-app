/**
 * The snapshot read of DiaryDayModel.startObservation's ValueObservation —
 * one query over the live-diary join plus the target and the day's exercise
 * rows. The model receives this loader through its constructor; the route file
 * builds it over the real handle, Jest over sql.js.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails } from '../../data/db/schema';
import {
  rowToDetail,
  rowToEntry,
  type DiaryEntry,
  type DiaryEntryDetail,
} from '../../data/repos/diaryEntryRepository';
import type { SqlDb } from '../../data/repos/sqlDb';
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
