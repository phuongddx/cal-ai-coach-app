/**
 * PGlite implementation of the store port — Postgres compiled to WASM that
 * starts in memory inside Jest (spec D4: "Tests may use PGlite … same SQL").
 * Same statements as `store.postgres.ts`, zero sockets in tests.
 *
 * Note: PGlite resolves internal resources with dynamic `import()`, so Jest
 * needs `--experimental-vm-modules` (set in this workspace's test script).
 */
import type { PGlite } from '@electric-sql/pglite';

import type { SqlQuery, SyncStoreApi } from './store';

export function createPgliteStore(db: PGlite): SyncStoreApi {
  async function query<Row = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<Row[]> {
    const result = await db.query<Record<string, unknown>>(text, [...params] as never[]);
    return result.rows as unknown as Row[];
  }

  return {
    query,
    transaction: async <Result>(work: (query: SqlQuery) => Promise<Result>): Promise<Result> =>
      (await db.transaction(
        async (tx) =>
          work((async (text: string, params: readonly unknown[] = []) => {
            const result = await tx.query<Record<string, unknown>>(text, [...params] as never[]);
            return result.rows as unknown as Record<string, unknown>[];
          }) as unknown as SqlQuery),
      )) as unknown as Result,
  };
}
