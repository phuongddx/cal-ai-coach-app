/**
 * The data half of the composition root (PL-02): the app's one database handle, the repositories
 * over it and the clock. `getSyncRuntime()` opens the handle; features and their route files get it
 * from here, so a save and the sync engine share one connection and one transaction window.
 * Nothing native runs at import time. U-51 folds this into the React environment.
 */
import { createCatalogRepository, type CatalogRepository } from './repos/catalogRepository';
import { createDiaryEntryRepository, type DiaryEntryRepository } from './repos/diaryEntryRepository';
import { createEngagementRepository, type EngagementRepository } from './repos/engagementRepository';
import { createOutboxRepository, type OutboxRepository } from './repos/outboxRepository';
import type { Clock } from './repos/sqlDb';
import { createTargetRepository, type TargetRepository } from './repos/targetRepository';
import { createTrackingRepository, type TrackingRepository } from './repos/trackingRepository';
import { getSyncRuntime, type SyncRuntime } from './sync/runtime';
import { newUuid } from './sync/uuid';

export type DataEnvironment = {
  db: SyncRuntime['db'];
  diaryEntries: DiaryEntryRepository;
  outbox: OutboxRepository;
  catalog: CatalogRepository;
  targets: TargetRepository;
  tracking: TrackingRepository;
  engagement: EngagementRepository;
  /** The injected clock (`now: @Sendable () -> Date` in the Swift app). */
  now: Clock;
};

const now: Clock = () => new Date();

let environment: DataEnvironment | null = null;

export async function getDataEnvironment(): Promise<DataEnvironment> {
  const { db } = await getSyncRuntime();
  if (environment === null || environment.db !== db) {
    environment = {
      db,
      diaryEntries: createDiaryEntryRepository(db, { newId: newUuid, now }),
      outbox: createOutboxRepository(db, { now }),
      catalog: createCatalogRepository(db),
      targets: createTargetRepository(db),
      tracking: createTrackingRepository(db, { newId: newUuid }),
      engagement: createEngagementRepository(db),
      now,
    };
  }
  return environment;
}

/** Test hook: forget the memoized environment. */
export function resetDataEnvironmentForTests(): void {
  environment = null;
}
