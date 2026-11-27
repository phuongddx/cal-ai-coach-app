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
 * One all-or-nothing write: BEGIN, run the body on the same handle, COMMIT —
 * ROLLBACK and rethrow on any failure.
 *
 * Deliberately not drizzle's `db.transaction`: the sql-js (sync) session
 * commits before an async body finishes, so awaited statements would run in
 * autocommit mode and a mid-body failure would leave rows behind. A raw
 * BEGIN/COMMIT window behaves identically on expo-sqlite (async) and sql.js
 * (sync) — the atomicity the diary save path depends on. Not re-entrant:
 * keep nested writes on the same handle, never a second BEGIN.
 */
export async function inTransaction<T>(db: SqlDb, body: (tx: SqlDb) => Promise<T> | T): Promise<T> {
  await db.run(sql.raw('BEGIN'));
  try {
    const result = await body(db);
    await db.run(sql.raw('COMMIT'));
    return result;
  } catch (error) {
    try {
      await db.run(sql.raw('ROLLBACK'));
    } catch {
      // The transaction was already rolled back or never opened; the
      // original error is what matters.
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
