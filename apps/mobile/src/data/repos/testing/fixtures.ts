/**
 * Shared Jest fixtures for the repository twins: a fresh migrated sql.js
 * database per test plus deterministic id/clock seams (the Swift tests use
 * fresh file-backed DBs and inject `now:` the same way).
 */
import { createSqlJsDb, type SqlJsFixture } from '../../db/testing/sqlJsDb';

export const FIXED_NOW_MS = 1_768_300_000_000;

export type RepoFixture = SqlJsFixture & {
  /** Deterministic UUIDs: 00000000-0000-4000-8000-<12 digits>. */
  newId: () => string;
  /** A controllable clock: starts at FIXED_NOW_MS, `setClock` moves it. */
  clock: () => Date;
  setClock: (ms: number) => void;
  resetIds: () => void;
};

export async function createRepoFixture(): Promise<RepoFixture> {
  const fixture = await createSqlJsDb();
  let idCounter = 0;
  let clockMs = FIXED_NOW_MS;
  return {
    ...fixture,
    newId: () => {
      idCounter += 1;
      return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
    },
    clock: () => new Date(clockMs),
    setClock: (ms: number) => {
      clockMs = ms;
    },
    resetIds: () => {
      idCounter = 0;
    },
  };
}

/** The `PRAGMA table_info` column names of a table, in declaration order. */
export function columnNames(client: RepoFixture['client'], table: string): string[] {
  const result = client.exec(`PRAGMA table_info(${table})`);
  const nameIndex = result[0]?.columns.indexOf('name') ?? -1;
  return (result[0]?.values ?? []).map((row) => String(row[nameIndex]));
}

/** Table names from sqlite_master. */
export function tableNames(client: RepoFixture['client']): string[] {
  const result = client.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
  return (result[0]?.values ?? []).map((row) => String(row[0]));
}

/** The index names SQLite holds for a table. */
export function indexNames(client: RepoFixture['client'], table: string): string[] {
  const result = client.exec(`PRAGMA index_list(${table})`);
  const nameIndex = result[0]?.columns.indexOf('name') ?? -1;
  return (result[0]?.values ?? []).map((row) => String(row[nameIndex]));
}

export async function countTable(fixture: RepoFixture, table: string): Promise<number> {
  const result = fixture.client.exec(`SELECT COUNT(*) FROM ${table}`);
  return Number(result[0]?.values[0]?.[0] ?? 0);
}

/** The outbox must stay empty: domain writes never enqueue sync operations. */
export async function countPendingOps(fixture: RepoFixture): Promise<number> {
  return countTable(fixture, 'pending_ops');
}

/** A UTC `YYYY-MM-DD` day string (the Swift tests' UTC DateFormatter). */
export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The local calendar `YYYY-MM-DD` (the Swift tests' localDayString). */
export function localDayString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
