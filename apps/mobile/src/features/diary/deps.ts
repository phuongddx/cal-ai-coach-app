/**
 * The constructor-injection bundle of the diary feature (standing-order rule
 * 19): repositories, the open database handle (DiaryDayModel takes the pool in
 * Swift), the local-mutation fan-out, the re-read signal, the owner id, the
 * clock and the id generator. The route file builds the real one from the data
 * seams; Jest builds test doubles over sql.js.
 */
import type { CatalogRepository } from '../../data/repos/catalogRepository';
import type { DiaryEntryRepository } from '../../data/repos/diaryEntryRepository';
import type { DiaryDetailRepository } from '../../data/repos/diaryDetailRepository';
import type { SqlDb, IdGenerator, Clock } from '../../data/repos/sqlDb';
import type { TargetRepository } from '../../data/repos/targetRepository';
import type { TrackingRepository } from '../../data/repos/trackingRepository';

export type DiaryDeps = {
  /** The open database handle — Swift's DatabasePool, read-only uses. */
  db: SqlDb;
  catalog: CatalogRepository;
  diaryEntries: DiaryEntryRepository;
  diaryDetails: DiaryDetailRepository;
  targets: TargetRepository;
  tracking: TrackingRepository;
  /** `notifyLocalMutation()` — called after every write so Today re-reads. */
  notify: () => void;
  ownerId: string;
  /** The re-read signal: fires after every local write and sync run. */
  subscribe: (listener: () => void) => () => void;
  now: Clock;
  newId: IdGenerator;
};
