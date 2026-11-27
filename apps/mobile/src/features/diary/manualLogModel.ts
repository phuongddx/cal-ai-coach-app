/**
 * FoodSearchView.saveManual — the manual-log write: the mirror entry from the
 * detail, one outbox op, the notify, then the detail row — the Swift order.
 * The kcal inside the detail was derived by DiaryMath at the sheet; this write
 * never re-derives or accepts a typed figure.
 */
import type { DiaryEntryDetail, DiaryEntryRepository } from '../../data/repos/diaryEntryRepository';
import type { DiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import type { Clock, IdGenerator } from '../../data/repos/sqlDb';

import { mealName } from './diaryMath';
import type { SavedReceipt } from './addFoodModel';
import { createWriteQueue } from './writeQueue';

export type ManualLogSaverDeps = {
  userId: string;
  diaryEntries: DiaryEntryRepository;
  diaryDetails: DiaryDetailRepository;
  notify: () => void;
  now: Clock;
  newId: IdGenerator;
};

export type ManualLogSaver = (detail: DiaryEntryDetail) => Promise<SavedReceipt>;

export function createManualLogSaver(deps: ManualLogSaverDeps): ManualLogSaver {
  const enqueue = createWriteQueue();
  return (detail: DiaryEntryDetail) =>
    enqueue(async (): Promise<SavedReceipt> => {
      const stamp = deps.now();
      await deps.diaryEntries.recordUpsert(
        {
          id: detail.entryId,
          userId: deps.userId,
          displayText: detail.title,
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: null,
          serverVersion: 0,
          acceptedOpId: null,
          serverUpdatedAt: stamp,
        },
        { now: stamp },
      );
      deps.notify();
      await deps.diaryDetails.upsert(detail);
      return {
        mealName: mealName(detail.mealSlot),
        kcalText: detail.kcal === null ? null : `${detail.kcal} kcal added`,
        entryIds: [detail.entryId],
      };
    });
}
