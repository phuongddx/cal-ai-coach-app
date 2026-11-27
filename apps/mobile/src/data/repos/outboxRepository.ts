/**
 * OutboxRepository.swift — the due batch (FIFO, at most 50), the dispatch
 * bookkeeping and the dead letter. Permanently failing ops stay in
 * `pending_ops` (the local mutation is never dropped) but are excluded from
 * `dueOps` so they cannot starve the batch quota.
 */
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { pendingOps } from '../db/schema';
import { fromIso, toIso, type Clock, type SqlDb } from './sqlDb';
import type { PendingOp } from './pendingOp';

export interface OutboxStatus {
  pendingCount: number;
  oldestCreatedAt: Date | null;
}

export const OUTBOX_BATCH_SIZE = 50;

export type OutboxRepositoryDeps = { now?: Clock };

export function createOutboxRepository(db: SqlDb, deps: OutboxRepositoryDeps = {}) {
  const now: Clock = deps.now ?? (() => new Date());

  return {
    /**
     * The due batch: not quarantined, retry time passed (or none), oldest
     * first — capped at the batch size of 50 no matter the asked limit.
     */
    async dueOps(limit: number): Promise<PendingOp[]> {
      const rows = await db
        .select()
        .from(pendingOps)
        .where(
          and(
            eq(pendingOps.quarantined, false),
            or(isNull(pendingOps.nextRetryAt), lte(pendingOps.nextRetryAt, toIso(now()))),
          ),
        )
        .orderBy(asc(pendingOps.createdAt), asc(pendingOps.opId))
        .limit(Math.min(limit, OUTBOX_BATCH_SIZE));
      return rows.map(rowToPendingOp);
    },

    /** Acknowledged operations are removed. */
    async markDispatched(opIds: string[]): Promise<void> {
      if (opIds.length === 0) return;
      await db.delete(pendingOps).where(inArray(pendingOps.opId, opIds));
    },

    /** Failed dispatch: bump the attempt counter, schedule the retry time. */
    async markFailed(opIds: string[], retryAt: Date): Promise<void> {
      if (opIds.length === 0) return;
      await db
        .update(pendingOps)
        .set({ dispatchAttempts: sql`${pendingOps.dispatchAttempts} + 1`, nextRetryAt: toIso(retryAt) })
        .where(inArray(pendingOps.opId, opIds));
    },

    /**
     * Dead letter: the row stays but leaves the due batch. Bumps the attempt
     * counter and clears the retry time.
     */
    async quarantine(opId: string): Promise<void> {
      await db
        .update(pendingOps)
        .set({
          quarantined: true,
          dispatchAttempts: sql`${pendingOps.dispatchAttempts} + 1`,
          nextRetryAt: null,
        })
        .where(eq(pendingOps.opId, opId));
    },

    /** Pending count and oldest creation across the whole outbox. */
    async statusSnapshot(): Promise<OutboxStatus> {
      const rows = await db
        .select({
          pendingCount: sql<number>`COUNT(*)`,
          oldestCreatedAt: sql<string | null>`MIN(${pendingOps.createdAt})`,
        })
        .from(pendingOps);
      const row = rows[0];
      return {
        pendingCount: Number(row?.pendingCount ?? 0),
        oldestCreatedAt: row?.oldestCreatedAt === null || row?.oldestCreatedAt === undefined ? null : fromIso(row.oldestCreatedAt),
      };
    },
  };
}

export type OutboxRepository = ReturnType<typeof createOutboxRepository>;

export function rowToPendingOp(row: typeof pendingOps.$inferSelect): PendingOp {
  return {
    opId: row.opId,
    tableName: row.tableName,
    recordId: row.recordId,
    kind: row.kind,
    snapshot: row.snapshot,
    clientTimestamp: fromIso(row.clientTimestamp),
    createdAt: fromIso(row.createdAt),
    dispatchAttempts: row.dispatchAttempts,
    nextRetryAt: row.nextRetryAt === null ? null : fromIso(row.nextRetryAt),
    quarantined: row.quarantined,
  };
}
