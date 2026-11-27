/**
 * DiaryDetailRepository.swift — the local-only detail rows of the diary
 * entries: fetch by entry, fetch a day+slot through the live-diary join
 * (soft-deleted entries never render), upsert, delete.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails } from '../db/schema';
import { rowToDetail, type DiaryEntryDetail } from './diaryEntryRepository';
import type { SqlDb } from './sqlDb';

export function createDiaryDetailRepository(db: SqlDb) {
  return {
    async detail(forEntryId: string): Promise<DiaryEntryDetail | null> {
      const rows = await db.select().from(diaryEntryDetails).where(eq(diaryEntryDetails.entryId, forEntryId)).limit(1);
      return rows[0] === undefined ? null : rowToDetail(rows[0]);
    },

    /**
     * The details of the day's live diary entries for the slot, in diary
     * order. The day grouping follows the local calendar: SQLite's
     * `date(created_at, 'localtime')` against the stored ISO timestamps.
     */
    async details(forDay: string, mealSlot: string): Promise<DiaryEntryDetail[]> {
      const rows = await db
        .select({ detail: diaryEntryDetails })
        .from(diaryEntryDetails)
        .innerJoin(diaryEntries, eq(diaryEntryDetails.entryId, diaryEntries.id))
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            sql`date(${diaryEntries.createdAt}, 'localtime') = ${forDay}`,
            eq(diaryEntryDetails.mealSlot, mealSlot),
          ),
        )
        .orderBy(asc(diaryEntries.createdAt));
      return rows.map((row) => rowToDetail(row.detail));
    },

    async upsert(detail: DiaryEntryDetail): Promise<void> {
      const row = { ...detail };
      await db
        .insert(diaryEntryDetails)
        .values(row)
        .onConflictDoUpdate({ target: diaryEntryDetails.entryId, set: row });
    },

    async delete(entryId: string): Promise<void> {
      await db.delete(diaryEntryDetails).where(eq(diaryEntryDetails.entryId, entryId));
    },
  };
}

export type DiaryDetailRepository = ReturnType<typeof createDiaryDetailRepository>;
