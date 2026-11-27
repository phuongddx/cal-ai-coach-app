/**
 * Ambient type surface for `sql.js` (the test SQLite engine). sql.js ships no
 * TypeScript declarations and adding @types/sql.js is a package change, so
 * this declares exactly what this package uses: `initSqlJs` and the
 * synchronous `Database` handle that `drizzle-orm/sql-js` wraps.
 */
declare module 'sql.js' {
  export interface SqlJsQueryResults {
    columns: string[];
    values: unknown[][];
  }

  export interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): SqlJsQueryResults[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: { new (data?: Uint8Array | Buffer | null): Database };
  }

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>;
}
