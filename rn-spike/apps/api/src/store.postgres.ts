/**
 * postgres.js implementation of the store port. Runs on the throwaway
 * PostgreSQL 17 cluster that `scripts/start-api.sh` provisions (port 5433).
 *
 * postgres.js returns int8 columns as strings; the routes normalise with
 * `Number()`, so the raw `Record<string, unknown>` rows are fine.
 */
import postgres from 'postgres';

import type { SqlQuery, SyncStoreApi } from './store';

export interface PostgresStore {
  store: SyncStoreApi;
  /** Closes the connection pool (best effort, safe to call at shutdown). */
  close: () => Promise<void>;
}

export function createPostgresStore(connectionString: string): PostgresStore {
  const sql = postgres(connectionString, {
    // A throwaway spike API: a small pool and a short idle timeout.
    max: 5,
    idle_timeout: 10,
  });

  async function query<Row = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<Row[]> {
    const rows = await sql.unsafe(text, [...params] as never[]);
    return rows as unknown as Row[];
  }

  const store: SyncStoreApi = {
    query,
    transaction: async <Result>(work: (query: SqlQuery) => Promise<Result>): Promise<Result> =>
      (await sql.begin(
        async (tx) =>
          work((async (text: string, params: readonly unknown[] = []) => {
            const rows = await tx.unsafe(text, [...params] as never[]);
            return rows as unknown as Record<string, unknown>[];
          }) as unknown as SqlQuery),
      )) as unknown as Result,
  };

  return { store, close: () => sql.end({ timeout: 1 }) };
}
