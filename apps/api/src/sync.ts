/**
 * POST /v1/sync/push and POST /v1/sync/pull on the ported SECURITY DEFINER functions
 * `sync_push(jsonb)` and `sync_pull(bigint)` (the API role has no table privileges).
 *
 * The wire contract (packages/api-contract/src/sync.ts, unchanged) speaks of meals and of a client-clock
 * last-writer-wins rule; the functions store one text per diary entry and order writes by a
 * server-owned global version. This adapter bridges the two:
 *
 *  - a meal travels in `diary_entries.display_text` as `{"v":1,"meal":{...}}`; a tombstone sets
 *    `deleted_at` (and keeps the last meal, or a placeholder when the record never reached the server);
 *  - the client-clock rule is decided here, from a read inside the same transaction: an upsert applies
 *    when `meal.updatedAt` is greater than the stored one, a tombstone when `clientTimestamp` is not older.
 *    A losing operation is not forwarded, answers `applied` with the current record and is not
 *    recorded in the ledger. A winner goes through `sync_push`, which numbers it;
 *  - `serverVersion` is the function's global version of the entry and a pull row's `seq` equals it;
 *  - `sync_ops_seen` opens the batch: it serialises same-user pushes and reports operation ids the
 *    ledger already acknowledged, which answer `duplicate` and write nothing;
 *  - pull pages in the adapter (`limit`, `hasMore`), because `sync_pull` returns every row after the cursor;
 *  - an operation aimed at a record another user owns makes `sync_push` raise 42501: the whole batch
 *    rolls back and answers 403.
 */
import {
  MealSchema,
  PullRequestSchema,
  PushRequestSchema,
  type Meal,
  type MealRecord,
  type PullRequest,
  type PushRequest,
  type SyncOperation,
} from '@coachcal/api-contract';
import type { Hono } from 'hono';

import { parseJson } from './auth/sql';
import type { Db, Query } from './db';
import { errorJson, json } from './http';
import { requireUser, validateJson, type RequireUserOptions, type ScanAppEnv } from './middleware';

interface MirrorRow {
  recordId: string;
  displayText: string;
  deletedAt: string | null;
  serverVersion: number;
  acceptedOpId: string | null;
}

/** The meal a tombstone leaves behind when the record never reached this server. */
const placeholderMeal = (id: string, clientTimestamp: number): Meal => ({
  id,
  eatenAt: '1970-01-01T00:00:00.000Z',
  name: '',
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  updatedAt: clientTimestamp,
});

const encodeMeal = (meal: Meal): string => JSON.stringify({ v: 1, meal });

/** Mirror row -> wire record; undefined when the stored text is not an envelope this adapter wrote. */
export function toRecord(row: MirrorRow): MealRecord | undefined {
  let envelope: unknown;
  try {
    envelope = JSON.parse(row.displayText);
  } catch {
    return undefined;
  }
  const meal = MealSchema.safeParse((envelope as { meal?: unknown } | null)?.meal);
  if (!meal.success) return undefined;
  return {
    ...meal.data,
    deleted: row.deletedAt !== null,
    serverVersion: Number(row.serverVersion),
    acceptedOpId: row.acceptedOpId,
  };
}

async function readRows(query: Query, recordIds: string[]): Promise<Map<string, MirrorRow>> {
  const rows = await query<{ r: unknown }>(`SELECT public.sync_records_get($1::uuid[]) AS r`, [recordIds]);
  const list = parseJson<MirrorRow[]>(rows[0]?.r ?? []);
  return new Map(list.map((row) => [row.recordId, row]));
}

function wins(operation: SyncOperation, stored: MealRecord | undefined): boolean {
  if (stored === undefined) return true;
  return operation.kind === 'upsert'
    ? operation.meal.updatedAt > stored.updatedAt
    : operation.clientTimestamp >= stored.updatedAt;
}

function toEnvelope(operation: SyncOperation, stored: MealRecord | undefined) {
  if (operation.kind === 'upsert') {
    return {
      opId: operation.opId,
      table: 'diary_entries',
      recordId: operation.recordId,
      kind: 'upsert',
      snapshot: { id: operation.recordId, displayText: encodeMeal(operation.meal), deletedAt: null },
      clientTimestamp: operation.clientTimestamp,
    };
  }
  const { deleted: _deleted, serverVersion: _version, acceptedOpId: _accepted, ...meal } =
    stored ?? { ...placeholderMeal(operation.recordId, operation.clientTimestamp), deleted: true, serverVersion: 0, acceptedOpId: null };
  return {
    opId: operation.opId,
    table: 'diary_entries',
    recordId: operation.recordId,
    kind: 'tombstone',
    snapshot: {
      id: operation.recordId,
      displayText: encodeMeal({ ...meal, updatedAt: operation.clientTimestamp }),
      deletedAt: new Date(operation.clientTimestamp).toISOString(),
    },
    clientTimestamp: operation.clientTimestamp,
  };
}

async function push(db: Db, userId: string, operations: PushRequest['operations']) {
  return db.withUser(userId, async (query) => {
    const seenRows = await query<{ r: unknown }>(`SELECT public.sync_ops_seen($1::uuid[]) AS r`, [
      operations.map((operation) => operation.opId),
    ]);
    const seen = new Set(parseJson<string[]>(seenRows[0]?.r ?? []));
    const rows = await readRows(query, [...new Set(operations.map((operation) => operation.recordId))]);

    const accepted: { opId: string; status: 'applied' | 'duplicate'; record: MealRecord }[] = [];
    for (const operation of operations) {
      const row = rows.get(operation.recordId);
      let status: 'applied' | 'duplicate' = 'applied';
      if (seen.has(operation.opId)) {
        status = 'duplicate';
      } else if (wins(operation, row && toRecord(row))) {
        await query(`SELECT public.sync_push($1::jsonb)`, [[toEnvelope(operation, row && toRecord(row))]]);
        seen.add(operation.opId);
        const fresh = (await readRows(query, [operation.recordId])).get(operation.recordId);
        if (fresh) rows.set(operation.recordId, fresh);
      }
      const current = rows.get(operation.recordId);
      const record = current && toRecord(current);
      // A seen operation always has a stored record; anything else is a genuine bug -> 500 INTERNAL.
      if (!record) throw new Error(`no stored record ${operation.recordId} for operation ${operation.opId}`);
      accepted.push({ opId: operation.opId, status, record });
    }
    return accepted;
  });
}

async function pull(db: Db, userId: string, request: PullRequest) {
  const result = await db.withUser(userId, async (query) => {
    const rows = await query<{ r: unknown }>(`SELECT public.sync_pull($1::bigint) AS r`, [request.cursor]);
    return parseJson<{ rows: { snapshot: Omit<MirrorRow, 'recordId'> & { id: string } }[] }>(rows[0]?.r);
  });
  const all = result.rows.map(({ snapshot }) => ({
    seq: Number(snapshot.serverVersion),
    record: toRecord({ ...snapshot, recordId: snapshot.id }),
  }));
  const hasMore = all.length > request.limit;
  const page = hasMore ? all.slice(0, request.limit) : all;
  const last = page.at(-1);
  return {
    // A row whose text this adapter did not write is skipped (the cursor still moves past it).
    rows: page.flatMap((row) => (row.record ? [{ seq: row.seq, record: row.record }] : [])),
    cursor: last === undefined ? request.cursor : last.seq,
    hasMore,
  };
}

export function registerSyncRoutes(app: Hono<ScanAppEnv>, deps: { db: Db }, auth: RequireUserOptions): void {
  const guard = requireUser(auth);

  app.post('/v1/sync/push', guard, validateJson(PushRequestSchema), async (c) => {
    try {
      const accepted = await push(deps.db, c.get('userId'), (c.get('body') as PushRequest).operations);
      return json(200, { accepted });
    } catch (error) {
      // sync_push raises 42501 for an operation aimed at another user's record.
      if ((error as { code?: string } | null)?.code === '42501') return errorJson(403, 'UNAUTHORIZED');
      throw error;
    }
  });

  app.post('/v1/sync/pull', guard, validateJson(PullRequestSchema), async (c) =>
    json(200, await pull(deps.db, c.get('userId'), c.get('body') as PullRequest)),
  );
}
