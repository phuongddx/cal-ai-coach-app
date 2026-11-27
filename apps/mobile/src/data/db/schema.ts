/**
 * Drizzle schema for the local SQLite store (spec D4: "Client store").
 *
 * - `meals`: the contract's Meal columns plus `serverVersion`, `acceptedOpId`.
 *   `serverVersion = 0` means "never acked by the server".
 * - `outbox`: one row per un-acked operation. A row exists for a record id =
 *   "has pending local intent" (spec D4) — there is no pending flag on meals.
 *   `queueSeq` gives FIFO order (assigned from MAX(queueSeq)+1 inside the
 *   write transaction, so same-millisecond writes keep their insertion order).
 * - `sync_state`: key/value for `cursor` and `deviceId`.
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(),
  eatenAt: text('eaten_at').notNull(),
  name: text('name').notNull(),
  kcal: real('kcal').notNull(),
  proteinG: real('protein_g').notNull(),
  carbsG: real('carbs_g').notNull(),
  fatG: real('fat_g').notNull(),
  fiberG: real('fiber_g').notNull(),
  /** Client wall clock at the edit, integer ms — the LWW clock. */
  updatedAt: integer('updated_at').notNull(),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  serverVersion: integer('server_version').notNull().default(0),
  acceptedOpId: text('accepted_op_id'),
});

export const outbox = sqliteTable(
  'outbox',
  {
    opId: text('op_id').primaryKey(),
    recordId: text('record_id').notNull(),
    kind: text('kind').notNull(),
    /** JSON of the contract `SyncOperation`. */
    payload: text('payload').notNull(),
    createdAt: integer('created_at').notNull(),
    queueSeq: integer('queue_seq').notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** 'pending' | 'quarantined' */
    state: text('state').notNull().default('pending'),
    lastError: text('last_error'),
  },
  (table) => [index('outbox_record_id_idx').on(table.recordId)],
);

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
