/**
 * The shared harness of the CoachCalSync Jest twins: what `makeHarness()`, `MockTransport`,
 * `EngineHarness` and `validAckResponse` are in `SyncEngineDispatchTests.swift`. A fresh migrated
 * sql.js database per test (the Swift tests use a fresh file-backed pool), the real SQLite sync store,
 * the real engine and a scripted transport.
 */
import { eq } from 'drizzle-orm';

import type { MealRecord, PullResponse, PushResponse, SyncOperation } from '@coachcal/api-contract';

import { diaryEntries, pendingOps, syncState } from '../../db/schema';
import { entryToRow, rowToEntry, snapshotFor, type DiaryEntry } from '../../repos/diaryEntryRepository';
import { fromIso, toIso } from '../../repos/sqlDb';
import { createRepoFixture, FIXED_NOW_MS, type RepoFixture } from '../../repos/testing/fixtures';
import { createSyncEngine, DEFAULT_DEBOUNCE_MS, type SyncEngine } from '../engine';
import { createSqliteSyncStore } from '../store.sqlite';
import type { SyncStore, SyncTransport } from '../types';

export const NOW_MS = FIXED_NOW_MS;

/** A transport failure the tests can recognise (Swift `SyncTransportFailure`). */
export class SyncTransportFailure extends Error {
  constructor() {
    super('SyncTransportFailure');
    this.name = 'SyncTransportFailure';
  }
}

/** Swift `MockTransport`: records every call and answers what the test scripted. */
export class MockTransport implements SyncTransport {
  pushCalls: SyncOperation[][] = [];
  pullCalls: number[] = [];
  pushResponse: PushResponse = { accepted: [] };
  pullResponse: PullResponse = { rows: [], cursor: 0, hasMore: false };
  pushDelayMs = 0;
  pushWait: (() => Promise<void>) | null = null;
  failure: Error | null = null;

  configure(options: {
    pushResponse?: PushResponse;
    pullResponse?: PullResponse;
    failure?: Error | null;
    pushDelayMs?: number;
    pushWait?: (() => Promise<void>) | null;
  }): void {
    if (options.pushResponse !== undefined) this.pushResponse = options.pushResponse;
    if (options.pullResponse !== undefined) this.pullResponse = options.pullResponse;
    this.failure = options.failure ?? null;
    if (options.pushDelayMs !== undefined) this.pushDelayMs = options.pushDelayMs;
    this.pushWait = options.pushWait ?? null;
  }

  async push(operations: SyncOperation[]): Promise<PushResponse> {
    this.pushCalls.push(operations);
    if (this.pushWait !== null) await this.pushWait();
    if (this.pushDelayMs > 0) await sleep(this.pushDelayMs);
    if (this.failure !== null) throw this.failure;
    return this.pushResponse;
  }

  async pull(cursor: number): Promise<PullResponse> {
    this.pullCalls.push(cursor);
    if (this.failure !== null) throw this.failure;
    return this.pullResponse;
  }
}

export type SeededOperation = {
  opId: string;
  recordId: string;
  entry: DiaryEntry;
};

export type EngineHarness = {
  fixture: RepoFixture;
  store: SyncStore;
  transport: MockTransport;
  engine: SyncEngine;
  /** The clock every engine and fixture time derives from. */
  now: Date;
  newId: () => string;
  seedOutbox(
    count: number,
    options?: { recordId?: string; nextRetryAt?: Date | null; insertMirror?: boolean },
  ): Promise<SeededOperation[]>;
  insertMirror(entry: DiaryEntry): Promise<void>;
  insertPendingRow(row: {
    opId: string;
    recordId: string;
    kind: string;
    snapshot: string;
  }): Promise<void>;
  readPending(opId: string): Promise<typeof pendingOps.$inferSelect | null>;
  readPendingIds(): Promise<Set<string>>;
  readEntry(id: string): Promise<DiaryEntry | null>;
  readCursor(): Promise<number>;
  /** `update pending_ops set next_retry_at = null` (the Swift test rewrites the row the same way). */
  clearRetryTime(opId: string): Promise<void>;
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Swift `validAckResponse(for:)`: every operation acknowledged once, version 1. */
export function validAckResponse(operations: ReadonlyArray<{ opId: string; recordId: string }>): PushResponse {
  return {
    accepted: operations.map((operation, index) => ({
      opId: operation.opId,
      status: 'applied' as const,
      record: recordFor(operation.recordId, { serverVersion: 1 + index, acceptedOpId: operation.opId }),
    })),
  };
}

/** A live wire record the transport can answer with. */
export function recordFor(
  recordId: string,
  extras: { serverVersion: number; acceptedOpId: string | null; name?: string; deleted?: boolean; updatedAt?: number },
): MealRecord {
  return {
    id: recordId,
    eatenAt: new Date(NOW_MS).toISOString(),
    name: extras.name ?? 'operation 0',
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    updatedAt: extras.updatedAt ?? NOW_MS,
    deleted: extras.deleted ?? false,
    serverVersion: extras.serverVersion,
    acceptedOpId: extras.acceptedOpId,
  };
}

export async function makeHarness(options: { debounceMs?: number } = {}): Promise<EngineHarness> {
  const fixture = await createRepoFixture();
  const now = new Date(NOW_MS);
  const store = createSqliteSyncStore(fixture.db);
  const transport = new MockTransport();
  const engine = createSyncEngine({
    store,
    transport,
    now: () => NOW_MS,
    isOnline: () => true,
    schedule: () => undefined, // the Swift engine has no retry timer: the retry waits for the next trigger
    debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
  });

  const insertMirror = async (entry: DiaryEntry): Promise<void> => {
    await fixture.db.insert(diaryEntries).values(entryToRow(entry));
  };

  const readPending = async (opId: string) => {
    const rows = await fixture.db.select().from(pendingOps).where(eq(pendingOps.opId, opId)).limit(1);
    return rows[0] ?? null;
  };

  return {
    fixture,
    store,
    transport,
    engine,
    now,
    newId: fixture.newId,
    insertMirror,

    async seedOutbox(count, seedOptions = {}) {
      const owner = fixture.newId();
      const seeded: SeededOperation[] = [];
      for (let index = 0; index < count; index += 1) {
        const id = seedOptions.recordId ?? fixture.newId();
        const entry: DiaryEntry = {
          id,
          userId: owner,
          displayText: `operation ${index}`,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          serverVersion: 0,
          acceptedOpId: null,
          serverUpdatedAt: now,
        };
        const opId = fixture.newId();
        if (seedOptions.insertMirror !== false) await insertMirror(entry);
        await fixture.db.insert(pendingOps).values({
          opId,
          tableName: 'diary_entries',
          recordId: id,
          kind: 'upsert',
          snapshot: snapshotFor(entry),
          clientTimestamp: toIso(now),
          createdAt: toIso(new Date(NOW_MS + index * 1_000)),
          dispatchAttempts: 0,
          nextRetryAt: seedOptions.nextRetryAt === undefined || seedOptions.nextRetryAt === null ? null : toIso(seedOptions.nextRetryAt),
          quarantined: false,
        });
        seeded.push({ opId, recordId: id, entry });
      }
      return seeded;
    },

    async insertPendingRow(row) {
      await fixture.db.insert(pendingOps).values({
        opId: row.opId,
        tableName: 'diary_entries',
        recordId: row.recordId,
        kind: row.kind,
        snapshot: row.snapshot,
        clientTimestamp: toIso(now),
        createdAt: toIso(now),
        dispatchAttempts: 0,
        nextRetryAt: null,
        quarantined: false,
      });
    },

    readPending,

    async readPendingIds() {
      const rows = await fixture.db.select({ opId: pendingOps.opId }).from(pendingOps);
      return new Set(rows.map((row) => row.opId));
    },

    async readEntry(id) {
      const rows = await fixture.db.select().from(diaryEntries).where(eq(diaryEntries.id, id)).limit(1);
      return rows[0] === undefined ? null : rowToEntry(rows[0]);
    },

    async readCursor() {
      const rows = await fixture.db.select().from(syncState).where(eq(syncState.id, 1)).limit(1);
      return rows[0]?.pullCursor ?? 0;
    },

    async clearRetryTime(opId) {
      await fixture.db.update(pendingOps).set({ nextRetryAt: null }).where(eq(pendingOps.opId, opId));
    },
  };
}

export { fromIso };
