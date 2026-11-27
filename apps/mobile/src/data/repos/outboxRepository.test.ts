/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/OutboxRepositoryTests.swift —
 * one case per Swift test, the same behavior sentences.
 */
import { eq } from 'drizzle-orm';
import { pendingOps } from '../db/schema';
import { insertPendingOp } from './diaryEntryRepository';
import { OUTBOX_BATCH_SIZE, createOutboxRepository, rowToPendingOp } from './outboxRepository';
import { createRepoFixture, FIXED_NOW_MS, type RepoFixture } from './testing/fixtures';
import type { SqlDb } from './sqlDb';
import type { PendingOp } from './pendingOp';

const BASE_MS = FIXED_NOW_MS;

async function makeFixture(): Promise<{ fixture: RepoFixture; repository: ReturnType<typeof createOutboxRepository> }> {
  const fixture = await createRepoFixture();
  return { fixture, repository: createOutboxRepository(fixture.db, { now: fixture.clock }) };
}

function makeOperation(opId: string, createdAt: Date, nextRetryAt: Date | null = null): PendingOp {
  return {
    opId,
    tableName: 'diary_entries',
    recordId: '1a86e36b-2c9f-4a1e-9f6f-000000000001',
    kind: 'upsert',
    snapshot: '{}',
    clientTimestamp: createdAt,
    createdAt,
    dispatchAttempts: 0,
    nextRetryAt,
    quarantined: false,
  };
}

async function insertAll(db: SqlDb, operations: PendingOp[]): Promise<void> {
  for (const operation of operations) {
    await insertPendingOp(db, operation);
  }
}

describe('OutboxRepositoryTests twins', () => {
  it('due ops returns the oldest fifty and excludes future retries', async () => {
    const { fixture, repository } = await makeFixture();
    const base = new Date(BASE_MS);
    const futureOperation = makeOperation(fixture.newId(), base, new Date(BASE_MS + 10 * 365 * 86_400_000));
    const operations = Array.from({ length: 55 }, (_, index) => makeOperation(fixture.newId(), new Date(BASE_MS + (index + 1) * 1000)));

    await insertAll(fixture.db, [futureOperation, ...operations]);

    const due = await repository.dueOps(100);
    expect(due).toHaveLength(50);
    expect(due[0]?.createdAt).toEqual(new Date(BASE_MS + 1000));
    expect(due[49]?.createdAt).toEqual(new Date(BASE_MS + 50_000));
    expect(due.some((operation) => operation.opId === futureOperation.opId)).toBe(false);
    expect(OUTBOX_BATCH_SIZE).toBe(50);
  });

  it('acknowledgement deletes and failure schedules a retry', async () => {
    const { fixture, repository } = await makeFixture();
    const base = new Date(BASE_MS);
    const acked = makeOperation(fixture.newId(), base);
    const failed = makeOperation(fixture.newId(), new Date(base.getTime() + 1000));
    const untouched = makeOperation(fixture.newId(), new Date(base.getTime() + 2000));
    await insertAll(fixture.db, [acked, failed, untouched]);

    await repository.markDispatched([acked.opId]);
    const retryAt = new Date(base.getTime() + 31_000);
    await repository.markFailed([failed.opId], retryAt);

    const rows = await fixture.db.select().from(pendingOps);
    const byOpId = new Map(rows.map((row) => [row.opId, rowToPendingOp(row)]));
    expect(byOpId.get(acked.opId)).toBeUndefined();
    expect(byOpId.get(failed.opId)?.dispatchAttempts).toBe(1);
    expect(byOpId.get(failed.opId)?.nextRetryAt).toEqual(retryAt);
    expect(byOpId.get(untouched.opId)).toEqual(untouched);
  });

  it('quarantine keeps the row but excludes it from due ops', async () => {
    const { fixture, repository } = await makeFixture();
    const base = new Date(BASE_MS);
    const quarantined = makeOperation(fixture.newId(), base);
    const live = makeOperation(fixture.newId(), new Date(base.getTime() + 1000));
    await insertAll(fixture.db, [quarantined, live]);

    await repository.quarantine(quarantined.opId);

    const due = await repository.dueOps(100);
    expect(due.map((operation) => operation.opId)).toEqual([live.opId]);
    const rows = await fixture.db.select().from(pendingOps).where(eq(pendingOps.opId, quarantined.opId));
    const stored = rowToPendingOp(rows[0]!);
    expect(stored.quarantined).toBe(true);
    expect(stored.dispatchAttempts).toBe(1);
    expect(stored.nextRetryAt).toBeNull();
  });

  it('status snapshot returns the pending count and the oldest creation', async () => {
    const { fixture, repository } = await makeFixture();
    const base = new Date(BASE_MS);

    const emptyStatus = await repository.statusSnapshot();
    expect(emptyStatus).toEqual({ pendingCount: 0, oldestCreatedAt: null });

    const operations = [
      makeOperation(fixture.newId(), new Date(base.getTime() + 2000)),
      makeOperation(fixture.newId(), base),
      makeOperation(fixture.newId(), new Date(base.getTime() + 3000), new Date(base.getTime() + 60_000)),
    ];
    await insertAll(fixture.db, operations);

    const status = await repository.statusSnapshot();
    expect(status).toEqual({ pendingCount: 3, oldestCreatedAt: base });
  });
});
