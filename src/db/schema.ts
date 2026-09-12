import { index, integer, primaryKey, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';

/**
 * Phase 1 local foundation schema. Every syncable row is partitioned by
 * `owner_id` (the locally authenticated user) so rows, queued outbox work, and
 * pull cursors can never cross a session boundary (Plan 01-02 checker
 * requirement). Server-derived ownership: `owner_id` is populated locally from
 * the authenticated session, never trusted from a network payload.
 */

/** Local mirror of the server `diary_entries` table (walking skeleton table). */
export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    /** Client-generated UUID primary key. */
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    /** Phase 1 business display field (no nutrition/VLM fields in Phase 1). */
    displayText: text('display_text').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    /** Soft tombstone; the row is never hard-deleted on device or server. */
    deletedAt: text('deleted_at'),
    /** Canonical server acceptance order; 0/null until first acknowledgement. */
    serverVersion: integer('server_version').notNull().default(0),
    acceptedOpId: text('accepted_op_id'),
    syncedAt: text('synced_at'),
  },
  (table) => [
    index('diary_entries_owner_idx').on(table.ownerId),
  ]
);

/**
 * Transactional outbox: one row per durable local mutation, inserted in the
 * SAME SQLite transaction as its mirror mutation. Immutable after creation —
 * retries update attempts/lastError only, never the payload.
 */
export const pendingOps = sqliteTable(
  'pending_ops',
  {
    /** Globally unique immutable operation identifier (client-generated UUID). */
    opId: text('op_id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    /** Per-owner monotonic sequence allocated inside the mutation transaction. */
    ownerSeq: integer('owner_seq').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    /** 'upsert' | 'tombstone' — validated against src/contracts/sync.ts. */
    kind: text('kind').notNull(),
    /** Serialized full-row snapshot (validated SyncOperation payload). */
    snapshotJson: text('snapshot_json').notNull(),
    /** Diagnostic only — never used for ordering. */
    clientTimestamp: text('client_timestamp').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('pending_ops_owner_seq_idx').on(table.ownerId, table.ownerSeq),
  ]
);

/** Durable per-owner, per-stream pull cursor. */
export const syncState = sqliteTable(
  'sync_state',
  {
    ownerId: text('owner_id').notNull(),
    /** Sync stream identifier (Phase 1: 'diary_entries'). */
    stream: text('stream').notNull(),
    pullCursor: integer('pull_cursor').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.stream] })]
);

export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type NewDiaryEntry = typeof diaryEntries.$inferInsert;
export type PendingOp = typeof pendingOps.$inferSelect;
export type NewPendingOp = typeof pendingOps.$inferInsert;
export type SyncState = typeof syncState.$inferSelect;
