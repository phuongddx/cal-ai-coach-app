/**
 * Row inserts the domain tests use directly (the Swift tests insert via
 * `pool.write { entry.insert($0) }`).
 */
import { diaryEntries } from '../../db/schema';
import { entryToRow } from '../diaryEntryRepository';
import type { RepoFixture } from './fixtures';

export async function insertDiaryEntryRow(
  fixture: RepoFixture,
  entry: {
    id: string;
    userId: string;
    displayText: string;
    createdAt: Date;
    deletedAt: Date | null;
  },
): Promise<void> {
  await fixture.db.insert(diaryEntries).values(
    entryToRow({
      id: entry.id,
      userId: entry.userId,
      displayText: entry.displayText,
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
      deletedAt: entry.deletedAt,
      serverVersion: 0,
      acceptedOpId: null,
      serverUpdatedAt: entry.createdAt,
    }),
  );
}
