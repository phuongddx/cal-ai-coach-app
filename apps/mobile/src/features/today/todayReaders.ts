/**
 * The readers of TodayModel's ValueObservation (TodayModel.startObservation): the live-diary join
 * for one local calendar day, plus the target, water and streak reads that already exist as
 * repositories. The route file builds this over the data environment; Jest builds it over sql.js.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails } from '../../data/db/schema';
import type { EngagementRepository } from '../../data/repos/engagementRepository';
import { fromIso, type SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository } from '../../data/repos/targetRepository';
import type { TrackingRepository } from '../../data/repos/trackingRepository';

import type { TodayReaders } from './todayModel';

export type TodayReaderDeps = {
  db: SqlDb;
  targets: TargetRepository;
  tracking: TrackingRepository;
  engagement: EngagementRepository;
};

export function createTodayReaders(deps: TodayReaderDeps): TodayReaders {
  return {
    async meals(owner, day) {
      const rows = await deps.db
        .select({ entry: diaryEntries, detail: diaryEntryDetails })
        .from(diaryEntries)
        .innerJoin(diaryEntryDetails, eq(diaryEntryDetails.entryId, diaryEntries.id))
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            eq(diaryEntries.userId, owner),
            // The day grouping follows the user's LOCAL calendar day (WR-02/CR-02).
            sql`date(${diaryEntries.createdAt}, 'localtime') = ${day}`,
          ),
        )
        .orderBy(asc(diaryEntries.createdAt));
      return rows.map(({ entry, detail }) => ({
        id: entry.id,
        title: detail.title,
        mealSlot: detail.mealSlot,
        kcal: detail.kcal,
        grams: detail.grams,
        proteinG: detail.proteinG,
        carbsG: detail.carbsG,
        fatG: detail.fatG,
        fiberG: detail.fiberG,
        confidence: detail.confidence,
        isSynced: entry.acceptedOpId !== null,
        loggedAt: fromIso(entry.createdAt),
      }));
    },
    activeTarget: (owner) => deps.targets.activeTarget(owner),
    waterMl: (day) => deps.tracking.water(day),
    streakState: () => deps.engagement.streakState(),
  };
}
