/**
 * The repositories behind `ScanModel.Persistence`, bound to the model's seam. Everything arrives through
 * the constructor (standing-order rule 19): this file never opens a database, it only calls the
 * repositories it was given. `save` is one `recordUpserts` call; the saved-card context sums today's
 * detail kcal over the four slots exactly as `loadSavedContext` does.
 */
import type { CatalogRepository } from '../../data/repos/catalogRepository';
import type { DiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import type { DiaryEntry, DiaryEntryRepository } from '../../data/repos/diaryEntryRepository';
import type { EngagementRepository } from '../../data/repos/engagementRepository';
import type { TargetRepository } from '../../data/repos/targetRepository';
import { MEAL_SLOTS, type SavedContext, type ScanPersistence } from './scanTypes';

export type ScanPersistenceRepositories = {
  entries: Pick<DiaryEntryRepository, 'recordUpserts' | 'recordTombstone'>;
  details: Pick<DiaryDetailRepository, 'details' | 'delete'>;
  catalog: Pick<CatalogRepository, 'saveMeal'>;
  targets: Pick<TargetRepository, 'activeTarget'>;
  engagement: Pick<EngagementRepository, 'streakState'>;
  fetchEntry: (id: string) => Promise<DiaryEntry | null>;
  ownerId: string;
};

export function createScanPersistence(repositories: ScanPersistenceRepositories): ScanPersistence {
  return {
    save: (upserts, now) => repositories.entries.recordUpserts(upserts, now),
    fetchEntry: (id) => repositories.fetchEntry(id),
    tombstone: (entry, options) => repositories.entries.recordTombstone(entry, options),
    deleteDetail: (entryId) => repositories.details.delete(entryId),
    saveMeal: (meal) => repositories.catalog.saveMeal(meal),
    async loadSavedContext(day: string): Promise<SavedContext> {
      let todayKcal = 0;
      for (const slot of MEAL_SLOTS) {
        const details = await repositories.details.details(day, slot).catch(() => []);
        todayKcal += details.reduce((total, detail) => total + (detail.kcal ?? 0), 0);
      }
      const target = await repositories.targets.activeTarget(repositories.ownerId).catch(() => null);
      const streak = await repositories.engagement.streakState().catch(() => null);
      return {
        todayKcal,
        goalKcal: target?.dailyKcal ?? null,
        streakCount: streak?.currentStreak ?? null,
        freezesLeft: streak?.freezesLeft ?? 0,
      };
    },
  };
}
