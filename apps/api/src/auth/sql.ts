import type { Query } from '../db';

/** postgres.js returns jsonb parsed; a driver that returns text gets parsed here. */
export function parseJson<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

/** Calls a function that returns one jsonb value and returns it (null stays null). */
export async function callJson<T>(query: Query, call: string, params: readonly unknown[]): Promise<T | null> {
  const rows = await query<{ r: unknown }>(`SELECT ${call} AS r`, params);
  const value = rows[0]?.r;
  return value === null || value === undefined ? null : parseJson<T>(value);
}
