/**
 * The driver-agnostic SQLite handle every repository takes: drizzle's base
 * class parameterized over either result kind (expo-sqlite is async, sql.js
 * is sync) and this app's schema. Both drivers satisfy it, so repositories
 * run unchanged in the app and under Jest (brief U-12: "Repositories take the
 * SQLiteDatabase type from drizzle-orm/sqlite-core, which both drivers
 * satisfy").
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

import type * as schema from '../db/schema';

export type SqlDb = BaseSQLiteDatabase<'sync' | 'async', any, typeof schema>;

/**
 * The tail of each handle's queue of writers. A WeakMap keyed by the database object, so one
 * handle has one queue and a closed handle is collected with it.
 */
const writerQueues = new WeakMap<object, Promise<unknown>>();

/**
 * One all-or-nothing write: BEGIN, run the body on the same handle, COMMIT —
 * ROLLBACK and rethrow on any failure.
 *
 * Deliberately not drizzle's `db.transaction`: the sql-js (sync) session
 * commits before an async body finishes, so awaited statements would run in
 * autocommit mode and a mid-body failure would leave rows behind. A raw
 * BEGIN/COMMIT window behaves identically on expo-sqlite (async) and sql.js
 * (sync) — the atomicity the diary save path depends on.
 *
 * One writer at a time per handle: SQLite allows one open transaction per
 * connection, so two overlapping calls used to break each other (the second
 * BEGIN failed, its catch rolled back the first caller's transaction, and the
 * rest of the first body autocommitted statement by statement). Calls now wait
 * for the previous one on the same handle, in call order. A failed call does
 * not block the next one, and only a transaction this call opened is rolled
 * back.
 *
 * Not re-entrant: a body must write through the `tx` it is given and must not
 * call `inTransaction` again on the same handle (the inner call would wait
 * for the outer one, which waits for it).
 */
export async function inTransaction<T>(db: SqlDb, body: (tx: SqlDb) => Promise<T> | T): Promise<T> {
  const previous = writerQueues.get(db) ?? Promise.resolve();
  const run = previous.then(() => runTransaction(db, body));
  // The queue keeps only the settling, never the outcome: a rejection must not poison the next writer.
  writerQueues.set(
    db,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function runTransaction<T>(db: SqlDb, body: (tx: SqlDb) => Promise<T> | T): Promise<T> {
  // A BEGIN that fails means this call never owned a transaction: nothing to roll back.
  await db.run(sql.raw('BEGIN'));
  try {
    const result = await body(db);
    await db.run(sql.raw('COMMIT'));
    return result;
  } catch (error) {
    try {
      await db.run(sql.raw('ROLLBACK'));
    } catch {
      // The transaction was already rolled back by SQLite itself; the original error is what matters.
    }
    throw error;
  }
}

/** A transaction handle: same type as the database (drizzle passes it down). */
export type SqlTx = SqlDb;

/** RFC 4122 v4 id factory — always src/data/sync/uuid.ts in production. */
export type IdGenerator = () => string;

/** Injectable clock, matching the Swift `now: @Sendable () -> Date` seams. */
export type Clock = () => Date;

/** Dates live in DATETIME columns as ISO-8601 UTC text (both drivers). */
export function toIso(date: Date): string {
  return date.toISOString();
}

export function fromIso(value: string): Date {
  return new Date(value);
}
