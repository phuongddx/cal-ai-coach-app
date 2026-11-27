/**
 * SyncMergeRepository.swift — applies server acknowledgements and a fully
 * validated pull response in one local transaction. Acknowledged operations
 * are removed atomically with the canonical version bump; a pulled row is
 * skipped while a pending local op exists for its record id ("pending local
 * intent"); the pull cursor advances only after all rows merge. LWW order is
 * `compareCanonicalVersions` from @coachcal/core (the CanonicalVersion port).
 *
 * RN addition (documented in parity-detail/data.md): `options.details` lets
 * the sync store write the `diary_entry_details` rows of applied pulled rows
 * inside the same transaction — the Swift pull snapshot carries no nutrition,
 * the RN wire record does.
 */
import { and, eq, ne } from 'drizzle-orm';

import {
  compareCanonicalVersions,
  type CanonicalRowVersion,
  type PullResponse,
  type PushAcknowledgement,
} from '@coachcal/core';

import { diaryEntries, pendingOps, syncState } from '../db/schema';
import {
  insertPendingOp,
  rowToEntry,
  snapshotFor,
  upsertDiaryEntry,
  upsertDiaryEntryDetail,
  type DiaryEntry,
  type DiaryEntryDetail,
} from './diaryEntryRepository';
import { inTransaction, type Clock, type SqlDb, type SqlTx } from './sqlDb';

export interface SyncMergeOutcome {
  appliedRowCount: number;
  cursor: number;
}

export type SyncMergeOptions = {
  now?: Date;
  /** Details to write for applied pulled rows, keyed by record id. */
  details?: ReadonlyMap<string, DiaryEntryDetail>;
};

export function createSyncMergeRepository(db: SqlDb, deps: { now?: Clock } = {}) {
  const now: Clock = deps.now ?? (() => new Date());

  return {
    /** Acknowledgements + pull page + cursor advance, all or nothing. */
    async apply(
      acknowledgements: PushAcknowledgement[],
      pull: PullResponse,
      owner: string,
      options: SyncMergeOptions = {},
    ): Promise<SyncMergeOutcome> {
      const at = options.now ?? now();
      let applied = 0;
      await inTransaction(db, async (tx) => {
        for (const acknowledgement of acknowledgements) {
          await applyAcknowledgement(tx, acknowledgement, at);
        }

        for (const row of pull.rows) {
          const wasApplied = await applyPulledRow(tx, row, owner, at);
          if (wasApplied) {
            applied += 1;
            const detail = options.details?.get(row.recordId);
            if (detail !== undefined) {
              await upsertDiaryEntryDetail(tx, detail);
            }
          }
        }

        const states = await tx.select().from(syncState).where(eq(syncState.id, 1)).limit(1);
        if (states[0] !== undefined) {
          await tx.update(syncState).set({ pullCursor: pull.cursor }).where(eq(syncState.id, 1));
        }
      });

      return { appliedRowCount: applied, cursor: pull.cursor };
    },

    async readCursor(): Promise<number> {
      const states = await db.select().from(syncState).where(eq(syncState.id, 1)).limit(1);
      return states[0]?.pullCursor ?? 0;
    },
  };
}

export type SyncMergeRepository = ReturnType<typeof createSyncMergeRepository>;

// ---------------------------------------------------------------------------
// Transaction bodies (also composed by src/data/sync/store.sqlite.ts)
// ---------------------------------------------------------------------------

/** Swift applyAcknowledgement: bump the mirror's canonical version, drop the op. */
export async function applyAcknowledgement(tx: SqlTx, acknowledgement: PushAcknowledgement, at: Date): Promise<void> {
  const operations = await tx.select().from(pendingOps).where(eq(pendingOps.opId, acknowledgement.opId)).limit(1);
  const operation = operations[0];
  if (operation === undefined) return;

  const entries = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, operation.recordId)).limit(1);
  const row = entries[0];
  if (row !== undefined) {
    const ackVersion = version(acknowledgement.serverVersion, acknowledgement.acceptedOpId);
    const localVersion = version(row.serverVersion, row.acceptedOpId);
    if (isNewer(ackVersion, localVersion)) {
      const accepted = rowToEntry(row);
      accepted.serverVersion = acknowledgement.serverVersion;
      accepted.acceptedOpId = acknowledgement.acceptedOpId;
      accepted.updatedAt = at;
      await upsertDiaryEntry(tx, accepted);
    }
  }

  await tx.delete(pendingOps).where(eq(pendingOps.opId, acknowledgement.opId));
}

/** What `applyAcknowledgedRecord` did to the mirror row. */
export type AcknowledgedRecordOutcome =
  /** The op was not in the outbox (acknowledged twice): nothing changed. */
  | 'unknown'
  /** A newer local op is still pending for the record: the op is gone, the mirror is untouched. */
  | 'kept'
  /** The op won: the local content stays and the canonical version is stamped. */
  | 'stamped'
  /** The op lost: the record the server keeps now sits in the mirror row (written like a pulled row). */
  | 'applied';

/**
 * A push acknowledgement together with the record the server answered with (the RN wire returns the
 * stored record for every operation; a losing operation is answered `applied` with the winner's
 * record and no version of its own).
 *
 * - The acknowledged op leaves the outbox in every case.
 * - Another pending op for the same record means the user edited again: the mirror stays as it is.
 * - Otherwise a winning op (`acceptedOpId` is its own id) keeps the local content and stamps the
 *   version, as the Swift acknowledgement does; a losing op writes the returned record into the
 *   mirror the way a pulled row is written, even when its version is not newer: the server is the
 *   authority on an operation it has answered, and skipping it would keep this device's rejected
 *   text under the winner's version for good.
 */
export async function applyAcknowledgedRecord(
  tx: SqlTx,
  acknowledgement: PushAcknowledgement,
  record: PullResponse['rows'][number],
  owner: string,
  at: Date,
): Promise<AcknowledgedRecordOutcome> {
  const operations = await tx.select().from(pendingOps).where(eq(pendingOps.opId, acknowledgement.opId)).limit(1);
  const operation = operations[0];
  if (operation === undefined) return 'unknown';

  const newer = await tx
    .select({ opId: pendingOps.opId })
    .from(pendingOps)
    .where(and(eq(pendingOps.recordId, operation.recordId), ne(pendingOps.opId, acknowledgement.opId)))
    .limit(1);
  if (newer.length > 0) {
    await tx.delete(pendingOps).where(eq(pendingOps.opId, acknowledgement.opId));
    return 'kept';
  }

  if (acknowledgement.acceptedOpId.toUpperCase() === acknowledgement.opId.toUpperCase()) {
    await applyAcknowledgement(tx, acknowledgement, at);
    return 'stamped';
  }

  await tx.delete(pendingOps).where(eq(pendingOps.opId, acknowledgement.opId));
  await applyPulledRow(tx, record, owner, at, { force: true });
  return 'applied';
}

/** Swift applyPulledRow. Returns true when the row was applied (inserted or updated). */
export async function applyPulledRow(
  tx: SqlTx,
  pulled: PullResponse['rows'][number],
  owner: string,
  at: Date,
  options: { /** Apply even when the record is not newer than the mirror (an acknowledged losing op). */ force?: boolean } = {},
): Promise<boolean> {
  const recordId = pulled.recordId;
  const pending = await tx
    .select({ opId: pendingOps.opId })
    .from(pendingOps)
    .where(eq(pendingOps.recordId, recordId))
    .limit(1);
  if (pending.length > 0) {
    return false; // pending local intent: the local write stays until it syncs
  }

  const remote = version(pulled.snapshot.serverVersion, pulled.snapshot.acceptedOpId ?? '');

  const entries = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, recordId)).limit(1);
  const local = entries[0];
  if (local !== undefined) {
    const localVersion = version(local.serverVersion, local.acceptedOpId);
    if (options.force !== true && !isNewer(remote, localVersion)) {
      return false;
    }
    const updated: DiaryEntry = {
      ...rowToEntry(local),
      displayText: pulled.snapshot.displayText,
      deletedAt: parseSnapshotDate(pulled.snapshot.deletedAt),
      serverVersion: pulled.snapshot.serverVersion,
      acceptedOpId: pulled.snapshot.acceptedOpId,
      updatedAt: at,
      serverUpdatedAt: at,
    };
    await upsertDiaryEntry(tx, updated);
    return true;
  }

  const row: DiaryEntry = {
    id: recordId,
    userId: owner,
    displayText: pulled.snapshot.displayText,
    createdAt: at,
    updatedAt: at,
    deletedAt: parseSnapshotDate(pulled.snapshot.deletedAt),
    serverVersion: pulled.snapshot.serverVersion,
    acceptedOpId: pulled.snapshot.acceptedOpId,
    serverUpdatedAt: at,
  };
  await upsertDiaryEntry(tx, row);
  return true;
}

/** Inserts a pending op for a diary mirror write, with the canonical snapshot. */
export async function enqueueDiaryOp(
  tx: SqlTx,
  op: { opId: string; recordId: string; kind: string; clientTimestamp: Date; createdAt: Date; entry: DiaryEntry },
): Promise<void> {
  await insertPendingOp(tx, {
    opId: op.opId,
    tableName: 'diary_entries',
    recordId: op.recordId,
    kind: op.kind,
    snapshot: snapshotFor(op.entry),
    clientTimestamp: op.clientTimestamp,
    createdAt: op.createdAt,
    dispatchAttempts: 0,
    nextRetryAt: null,
    quarantined: false,
  });
}

// ---------------------------------------------------------------------------
// The Swift (version, opId) pair rules, over the core comparator
// ---------------------------------------------------------------------------

function version(serverVersion: number, acceptedOpId: string | null): CanonicalRowVersion {
  return { serverVersion, acceptedOpId: acceptedOpId ?? '' };
}

/** Swift SyncMergeRepository.isNewer: strictly newer only — equal pairs lose. */
function isNewer(candidate: CanonicalRowVersion, incumbent: CanonicalRowVersion): boolean {
  const winner = compareCanonicalVersions(candidate, incumbent);
  if (winner !== candidate) return false;
  // The comparator returns the first argument for identical values; identical
  // values are not newer.
  return (
    candidate.serverVersion !== incumbent.serverVersion ||
    candidate.acceptedOpId.toUpperCase() !== incumbent.acceptedOpId.toUpperCase()
  );
}

function parseSnapshotDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
