import type { SqlDb } from './repos/sqlDb';

const mockRuntime = { db: {} as SqlDb, notifyLocalWrite: jest.fn() };

jest.mock('./sync/runtime', () => ({
  getSyncRuntime: jest.fn(async () => mockRuntime),
}));

import { getDataEnvironment, resetDataEnvironmentForTests } from './environment';

describe('data environment', () => {
  beforeEach(() => {
    resetDataEnvironmentForTests();
  });

  it('returns the same environment for every call', async () => {
    const first = await getDataEnvironment();
    const second = await getDataEnvironment();
    expect(second).toBe(first);
  });

  it('creates every repository over the database handle of the sync runtime', async () => {
    const environment = await getDataEnvironment();
    expect(environment.db).toBe(mockRuntime.db);
    expect(environment.diaryEntries.recordUpserts).toBeInstanceOf(Function);
    expect(environment.outbox.dueOps).toBeInstanceOf(Function);
    expect(environment.catalog.searchFoods).toBeInstanceOf(Function);
    expect(environment.targets.saveTarget).toBeInstanceOf(Function);
    expect(environment.tracking.addExercise).toBeInstanceOf(Function);
    expect(environment.engagement.saveStreakState).toBeInstanceOf(Function);
  });

  it('keeps one instance of each repository', async () => {
    const first = await getDataEnvironment();
    const second = await getDataEnvironment();
    expect(second.diaryEntries).toBe(first.diaryEntries);
    expect(second.catalog).toBe(first.catalog);
  });

  it('reads the clock as the current date', async () => {
    const before = Date.now();
    const environment = await getDataEnvironment();
    const read = environment.now().getTime();
    expect(read).toBeGreaterThanOrEqual(before);
    expect(read).toBeLessThanOrEqual(Date.now());
  });
});
