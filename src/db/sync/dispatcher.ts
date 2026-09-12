import { and, asc, eq } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type {
  ExpoSQLiteDatabase,
  ExpoSQLiteTransaction,
} from 'drizzle-orm/expo-sqlite';

import {
  PullResponseSchema,
  PushResponseSchema,
  type PushRequest,
} from '../../contracts/sync';
import { pendingOps, syncState } from '../schema';
import { applyAcknowledgement, applyPullResponse } from './merge';
import { validateStoredOperation, type SyncTransport } from './transport';

/**
 * Bounded, owner-scoped reconciliation dispatch (Plan 01-04 Task 2).
 *
 * One run = push at most 50 pending operations (current owner, sequence
 * order) → apply acknowledgements transactionally → pull remote changes →
 * merge + advance the cursor transactionally. Every durable effect is
 * predicated on the active ownerId. A transport or validation failure leaves
 * all pending operations intact (attempts metadata only) and propagates to
 * the scheduler.
 */

type Schema = Record<string, never>;
type Tx = ExpoSQLiteTransaction<Schema, ExtractTablesWithRelations<Schema>>;
type Db = ExpoSQLiteDatabase<Schema>;

const SYNC_STREAM = 'diary_entries';
export const PUSH_BATCH_LIMIT = 50;

export interface DispatchDeps {
  transport: SyncTransport;
}

export interface DispatchResult {
  pushed: number;
  acked: number;
  pulled: number;
  poisoned: number;
  cursorAdvanced: boolean;
}

function currentCursor(db: Db, ownerId: string): number {
  return (
    db
      .select()
      .from(syncState)
      .where(and(eq(syncState.ownerId, ownerId), eq(syncState.stream, SYNC_STREAM)))
      .all()[0]?.pullCursor ?? 0
  );
}

/**
 * Runs one reconciliation pass for `ownerId`.
 * Throws TransportError (or validation errors) when the transport fails —
 * callers (lifecycle scheduler) own retry policy.
 */
export async function runDispatch(
  db: Db,
  ownerId: string,
  deps: DispatchDeps
): Promise<DispatchResult> {
  const { transport } = deps;

  // --- Load the current owner's batch (bounded, sequence-ordered) ----------
  const queued = db
    .select()
    .from(pendingOps)
    .where(eq(pendingOps.ownerId, ownerId))
    .orderBy(asc(pendingOps.ownerSeq))
    .limit(PUSH_BATCH_LIMIT)
    .all();

  const operations: PushRequest['operations'] = [];
  const poisoned: string[] = [];
  for (const op of queued) {
    try {
      const snapshot = JSON.parse(op.snapshotJson);
      const operation = validateStoredOperation({
        opId: op.opId,
        table: op.tableName,
        recordId: op.recordId,
        kind: op.kind,
        snapshot,
        clientTimestamp: op.clientTimestamp,
      });
      operations.push(operation);
    } catch (error) {
      // Poison operation: isolated so it cannot block the healthy queue.
      poisoned.push(op.opId);
      db.update(pendingOps)
        .set({
          attempts: op.attempts + 1,
          lastError: `invalid stored operation: ${(error as Error).message}`,
        })
        .where(
          and(eq(pendingOps.opId, op.opId), eq(pendingOps.ownerId, ownerId))
        )
        .run();
    }
  }

  // --- Push + acknowledge ---------------------------------------------------
  let acked = 0;
  if (operations.length > 0) {
    let response;
    try {
      // Defense in depth: re-validate the server response against the shared
      // contract even if the transport already parsed it.
      response = PushResponseSchema.parse(await transport.push({ operations }));
    } catch (error) {
      // Observable failure: every pending operation stays intact; only retry
      // metadata moves. Never fabricate a new operation from committed rows.
      const message = (error as Error).message;
      for (const operation of operations) {
        const stored = db
          .select()
          .from(pendingOps)
          .where(
            and(
              eq(pendingOps.opId, operation.opId),
              eq(pendingOps.ownerId, ownerId)
            )
          )
          .all()[0];
        if (stored) {
          db.update(pendingOps)
            .set({ attempts: stored.attempts + 1, lastError: message })
            .where(
              and(
                eq(pendingOps.opId, operation.opId),
                eq(pendingOps.ownerId, ownerId)
              )
            )
            .run();
        }
      }
      throw error;
    }

    db.transaction((tx) => {
      for (const ack of response.accepted) {
        applyAcknowledgement(tx, ownerId, ack);
        acked += 1;
      }
    });
  }

  // --- Pull + merge + cursor ------------------------------------------------
  const cursor = currentCursor(db, ownerId);
  const pullResponse = PullResponseSchema.parse(await transport.pull({ cursor }));

  const pulled = pullResponse.rows.length;
  let cursorAdvanced = false;
  db.transaction((tx) => {
    applyPullResponse(tx, ownerId, pullResponse);
  });
  const newCursor = currentCursor(db, ownerId);
  cursorAdvanced = newCursor !== cursor || pulled > 0;

  return {
    pushed: operations.length,
    acked,
    pulled,
    poisoned: poisoned.length,
    cursorAdvanced,
  };
}
