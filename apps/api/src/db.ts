/**
 * The one database client (postgres.js, role coachcal_api) and `withUser`.
 *
 * `withUser(userId, fn)` opens a transaction, runs
 * `SELECT set_config('app.user_id', $1, true)` (transaction-local, so it can never
 * leak to the next request on the pooled connection), calls `fn`, then commits. The
 * SQL functions read that setting where the Supabase originals read `auth.uid()`.
 * The role holds no table privileges: every read and write is a function call.
 */
import postgres from 'postgres';

/** One parameterised statement; the same shape as the sync store's `SqlQuery`. */
export type Query = <Row = Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => Promise<Row[]>;

export interface Db {
  withUser<T>(userId: string, fn: (query: Query) => Promise<T>): Promise<T>;
  /**
   * A transaction with no user set: for the pre-sign-in functions (`auth_*`), which take their
   * inputs explicitly and validate them because there is no caller yet.
   */
  withoutUser<T>(fn: (query: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createDb(connectionString: string | undefined = process.env.DATABASE_URL): Db {
  if (!connectionString) throw new Error('DATABASE_URL must be configured');
  const sql = postgres(connectionString, { max: 10, idle_timeout: 20 });

  return {
    withUser: async <T>(userId: string, fn: (query: Query) => Promise<T>): Promise<T> =>
      (await sql.begin(async (tx) => {
        await tx.unsafe(`SELECT set_config('app.user_id', $1, true)`, [userId]);
        const query: Query = async (text, params = []) =>
          (await tx.unsafe(text, [...params] as never[])) as unknown as never[];
        return fn(query);
      })) as unknown as T,
    withoutUser: async <T>(fn: (query: Query) => Promise<T>): Promise<T> =>
      (await sql.begin(async (tx) => {
        const query: Query = async (text, params = []) =>
          (await tx.unsafe(text, [...params] as never[])) as unknown as never[];
        return fn(query);
      })) as unknown as T,
    close: () => sql.end({ timeout: 1 }),
  };
}

let shared: Db | undefined;

/** The process-wide client, created on first use from DATABASE_URL. */
export function getDb(): Db {
  shared ??= createDb();
  return shared;
}

/** `withUser` on the process-wide client. */
export function withUser<T>(userId: string, fn: (query: Query) => Promise<T>): Promise<T> {
  return getDb().withUser(userId, fn);
}
