/**
 * The `query(sql, params)` port the sync routes are written against (spec D4).
 *
 * Both implementations run the same SQL text: `store.postgres.ts` wraps
 * postgres.js for the real PostgreSQL 17 runtime, `store.pglite.ts` wraps
 * PGlite (Postgres compiled to WASM) inside Jest.
 */

/** One parameterised SQL statement against the store. */
export type SqlQuery = <Row = Record<string, unknown>>(
  sql: string,
  params?: readonly unknown[],
) => Promise<Row[]>;

export interface SyncStoreApi {
  query: SqlQuery;
  /**
   * Runs `work` inside one transaction; a thrown error rolls everything back.
   * The `query` handed to `work` is transaction-scoped.
   */
  transaction: <T>(work: (query: SqlQuery) => Promise<T>) => Promise<T>;
}
