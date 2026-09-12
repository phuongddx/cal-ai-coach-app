import { DatabaseSync, type StatementSync } from 'node:sqlite';

/**
 * TEST-ONLY adapter: a node:sqlite-backed client implementing the narrow
 * sync surface drizzle-orm/expo-sqlite consumes (prepareSync → executeSync /
 * executeForRawResultSync). This lets migration and repository tests run the
 * REAL drizzle expo driver and the REAL bundled migrations against a real
 * SQLite engine (Node's built-in) — never the expo-sqlite SSR dummy stub.
 *
 * The shipping app uses src/db/client.ts (expo-sqlite native/WASM); physical
 * device proof of that binary is Plan 01-05's checkpoint.
 *
 * NOT for production use — never import from app code.
 */

interface DrizzleStatementResult {
  changes: number;
  lastInsertRowId: number | bigint | undefined;
  getAllSync(): Record<string, unknown>[];
  getFirstSync(): Record<string, unknown> | undefined;
}

interface DrizzleRawResult {
  getAllSync(): unknown[][];
}

interface DrizzleStatement {
  executeSync(params: unknown[]): DrizzleStatementResult;
  executeForRawResultSync(params: unknown[]): DrizzleRawResult;
}

export interface NodeSqliteTestClient {
  prepareSync(sql: string): DrizzleStatement;
  execSync(source: string): void;
  closeSync(): void;
}

class NodeSqliteStatement implements DrizzleStatement {
  constructor(private readonly stmt: StatementSync) {}

  executeSync(params: unknown[]): DrizzleStatementResult {
    const info = this.stmt.run(...(params as never[]));
    return {
      changes: Number(info.changes ?? 0),
      lastInsertRowId: info.lastInsertRowid as number | bigint | undefined,
      getAllSync: () => {
        this.stmt.setReturnArrays(false);
        return this.stmt.all(...(params as never[])) as Record<
          string,
          unknown
        >[];
      },
      getFirstSync: () => {
        this.stmt.setReturnArrays(false);
        return this.stmt.all(...(params as never[]))[0] as
          | Record<string, unknown>
          | undefined;
      },
    };
  }

  executeForRawResultSync(params: unknown[]): DrizzleRawResult {
    return {
      getAllSync: () => {
        this.stmt.setReturnArrays(true);
        return this.stmt.all(...(params as never[])) as unknown as unknown[][];
      },
    };
  }
}

class NodeSqliteClient implements NodeSqliteTestClient {
  constructor(private readonly node: DatabaseSync) {}

  prepareSync(sql: string): DrizzleStatement {
    return new NodeSqliteStatement(this.node.prepare(sql));
  }

  execSync(source: string): void {
    this.node.exec(source);
  }

  closeSync(): void {
    this.node.close();
  }
}

/** Opens an isolated (default in-memory) real SQLite database for tests. */
export function openNodeSqliteTestDb(
  path: string = ':memory:'
): NodeSqliteTestClient {
  return new NodeSqliteClient(new DatabaseSync(path));
}
