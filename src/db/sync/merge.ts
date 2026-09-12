import { and, eq } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type {
  ExpoSQLiteDatabase,
  ExpoSQLiteTransaction,
} from 'drizzle-orm/expo-sqlite';

import type {
  PullResponse,
  PushAcknowledgement,
} from '../../contracts/sync';
import {
  diaryEntries,
  pendingOps,
  syncState,
  type DiaryEntry,
} from '../schema';
import { canonicalEquals, isNewerCanonical } from './ordering';

/**
 * Deterministic, owner-scoped reconciliation merge (Plan 01-04 Task 1).
 *
 * Pure persistence logic: no React, no network, no screen imports. Every
 * lookup and write is predicated on the active `ownerId` — a response handled
 * under one session can never touch another session's mirror, queue, or
 * cursor. Remote rows apply only under the canonical comparator; a record id
 * held as unsynced (pending) intent — by any local session — is never
 * materialized from a remote response.
 */

type Schema = Record<string, never>;
type Tx = ExpoSQLiteTransaction<Schema, ExtractTablesWithRelations<Schema>>;
type Db = ExpoSQLiteDatabase<Schema>;
export type MergeConnection = Db | Tx;

const SYNC_STREAM = 'diary_entries';

function findPending(tx: MergeConnection, ownerId: string, opId: string) {
  return tx
    .select()
    .from(pendingOps)
    .where(and(eq(pendingOps.opId, opId), eq(pendingOps.ownerId, ownerId)))
    .all()[0];
}

function hasPendingFor(tx: MergeConnection, ownerId: string, recordId: string): boolean {
  return (
    tx
      .select()
      .from(pendingOps)
      .where(
        and(eq(pendingOps.recordId, recordId), eq(pendingOps.ownerId, ownerId))
      )
      .all().length > 0
  );
}

function hasPendingAnyOwner(tx: MergeConnection, recordId: string): boolean {
  return (
    tx
      .select()
      .from(pendingOps)
      .where(eq(pendingOps.recordId, recordId))
      .all().length > 0
  );
}

function findLocalRow(
  tx: MergeConnection,
  ownerId: string,
  recordId: string
): DiaryEntry | undefined {
  return tx
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.id, recordId), eq(diaryEntries.ownerId, ownerId)))
    .all()[0];
}

/**
 * Applies one server acknowledgement under the active owner:
 * removes exactly the acknowledged same-owner operation, and bumps the local
 * row's canonical fields when the ack carries a newer canonical version.
 * Row CONTENT still arrives via pull — an ack never invents row data.
 */
export function applyAcknowledgement(
  tx: Tx,
  ownerId: string,
  ack: PushAcknowledgement
): void {
  const op = findPending(tx, ownerId, ack.opId);
  if (!op) {
    // Unmatched ack (already applied or foreign session) — stable no-op.
    return;
  }

  const row = findLocalRow(tx, ownerId, op.recordId);
  if (row) {
    const ackCanonical = {
      serverVersion: ack.serverVersion,
      acceptedOpId: ack.acceptedOpId,
    };
    const rowCanonical = {
      serverVersion: row.serverVersion,
      acceptedOpId: row.acceptedOpId ?? '',
    };
    if (isNewerCanonical(ackCanonical, rowCanonical)) {
      tx
        .update(diaryEntries)
        .set({
          serverVersion: ack.serverVersion,
          acceptedOpId: ack.acceptedOpId,
          syncedAt: new Date().toISOString(),
        })
        .where(
          and(eq(diaryEntries.id, row.id), eq(diaryEntries.ownerId, ownerId))
        )
        .run();
    }
  }

  tx
    .delete(pendingOps)
    .where(and(eq(pendingOps.opId, ack.opId), eq(pendingOps.ownerId, ownerId)))
    .run();
}

/**
 * Applies one pulled row under the active owner:
 * - never writes a record that exists (or is pending intent) under a different
 *   local session,
 * - materializes missing rows (including remote tombstones) as owned rows,
 * - overwrites only when the remote canonical version is strictly newer,
 * - skips when an unsynced same-owner operation still exists for the record —
 *   that operation carries the authoritative local snapshot.
 */
export function applyPulledRow(
  tx: MergeConnection,
  ownerId: string,
  row: PullResponse['rows'][number]
): void {
  const snapshot = row.snapshot;

  const owned = findLocalRow(tx, ownerId, row.recordId);
  if (owned) {
    if (hasPendingFor(tx, ownerId, row.recordId)) return;

    const remoteCanonical = {
      serverVersion: snapshot.serverVersion,
      acceptedOpId: snapshot.acceptedOpId ?? '',
    };
    const localCanonical = {
      serverVersion: owned.serverVersion,
      acceptedOpId: owned.acceptedOpId ?? '',
    };
    if (canonicalEquals(remoteCanonical, localCanonical)) return;
    if (!isNewerCanonical(remoteCanonical, localCanonical)) return;

    tx
      .update(diaryEntries)
      .set({
        displayText: snapshot.displayText,
        deletedAt: snapshot.deletedAt,
        serverVersion: snapshot.serverVersion,
        acceptedOpId: snapshot.acceptedOpId,
        syncedAt: new Date().toISOString(),
      })
      .where(
        and(eq(diaryEntries.id, owned.id), eq(diaryEntries.ownerId, ownerId))
      )
      .run();
    return;
  }

  // No row for this session. If the id exists under ANOTHER owner, the
  // response does not belong to this session — never write across the
  // owner boundary.
  const foreign = tx
    .select()
    .from(diaryEntries)
    .where(eq(diaryEntries.id, row.recordId))
    .all()[0];
  if (foreign) return;

  // Preserve pending intent — under ANY owner: an id held as unsynced intent
  // belongs to that session until the server has arbitrated it.
  if (hasPendingAnyOwner(tx, row.recordId)) return;

  tx
    .insert(diaryEntries)
    .values({
      id: snapshot.id,
      ownerId,
      displayText: snapshot.displayText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: snapshot.deletedAt,
      serverVersion: snapshot.serverVersion,
      acceptedOpId: snapshot.acceptedOpId,
      syncedAt: new Date().toISOString(),
    })
    .run();
}

/** Merges a full validated pull response and advances the owner cursor atomically. */
export function applyPullResponse(
  tx: Tx,
  ownerId: string,
  response: PullResponse
): void {
  for (const row of response.rows) {
    applyPulledRow(tx, ownerId, row);
  }

  const existing = tx
    .select()
    .from(syncState)
    .where(
      and(eq(syncState.ownerId, ownerId), eq(syncState.stream, SYNC_STREAM))
    )
    .all()[0];

  if (existing) {
    tx
      .update(syncState)
      .set({ pullCursor: response.cursor })
      .where(
        and(eq(syncState.ownerId, ownerId), eq(syncState.stream, SYNC_STREAM))
      )
      .run();
  } else {
    tx
      .insert(syncState)
      .values({ ownerId, stream: SYNC_STREAM, pullCursor: response.cursor })
      .run();
  }
}
