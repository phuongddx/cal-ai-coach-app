/**
 * POST /v1/sync/push and POST /v1/sync/pull (spec D4).
 *
 * Push, per operation, inside one transaction:
 *  - an `op_id` seen before answers `duplicate` with the current record and writes nothing;
 *  - an upsert with `meal.updatedAt` greater than the stored row's overwrites it and
 *    appends a change; an older upsert is a no-op that answers `applied` with the
 *    current record;
 *  - a tombstone sets `deleted` and wins when its `clientTimestamp` is not older than
 *    the stored `updatedAt`;
 *  - every answer returns the server's current record so the client converges.
 *
 * Pull returns changes with `seq > cursor` in order, pages by `limit`, and a
 * `hasMore` that is true only when more rows exist. Users never see each other's rows.
 */
import {
  PullRequestSchema,
  PushRequestSchema,
  type MealRecord,
  type SyncOperation,
} from '@coachcal/api-contract';
import { zValidator } from '@hono/zod-validator';
import type { Hono } from 'hono';

import type { SqlQuery, SyncStoreApi } from './store';

type AppEnv = { Variables: { userId: string } };

/** Zod failure -> 400 INVALID_REQUEST with the issues as details (spec D4). */
const invalidRequest = (
  c: { json: (body: unknown, status: 400) => Response },
  error: { issues: unknown[] },
): Response => c.json({ error: { code: 'INVALID_REQUEST', details: error.issues } }, 400);

/** Normalises a `meals` row into the wire record. `Number()` accepts both drivers' number/string forms. */
function toRecord(row: Record<string, unknown>): MealRecord {
  return {
    id: String(row.id),
    eatenAt: String(row.eaten_at),
    name: String(row.name),
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: Number(row.fiber_g),
    updatedAt: Number(row.updated_at),
    deleted: Boolean(row.deleted),
    serverVersion: Number(row.server_version),
    acceptedOpId: row.accepted_op_id === null || row.accepted_op_id === undefined ? null : String(row.accepted_op_id),
  };
}

async function appendChange(query: SqlQuery, userId: string, record: MealRecord): Promise<void> {
  await query(
    `INSERT INTO sync_changes (user_id, record_id, record) VALUES ($1, $2, $3::jsonb)`,
    [userId, record.id, JSON.stringify(record)],
  );
}

async function processPushOperation(
  query: SqlQuery,
  userId: string,
  operation: SyncOperation,
): Promise<{ opId: string; status: 'applied' | 'duplicate'; record: MealRecord }> {
  const seen = await query(
    `SELECT 1 AS seen FROM sync_ops WHERE user_id = $1 AND op_id = $2`,
    [userId, operation.opId],
  );
  if (seen.length > 0) {
    // Idempotent replay: the current record, nothing written.
    const current = await query(
      `SELECT * FROM meals WHERE user_id = $1 AND id = $2`,
      [userId, operation.recordId],
    );
    const row = current[0];
    if (row === undefined) {
      // A seen op always has a stored record; this is a genuine bug -> 500 INTERNAL.
      throw new Error(`sync_ops row ${operation.opId} has no stored record ${operation.recordId}`);
    }
    return { opId: operation.opId, status: 'duplicate', record: toRecord(row) };
  }

  await query(
    `INSERT INTO sync_ops (user_id, op_id, record_id, kind, client_timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, operation.opId, operation.recordId, operation.kind, operation.clientTimestamp],
  );

  const existingRows = await query(
    `SELECT * FROM meals WHERE user_id = $1 AND id = $2 FOR UPDATE`,
    [userId, operation.recordId],
  );
  const existing = existingRows[0];

  if (operation.kind === 'upsert') {
    if (existing === undefined) {
      await query(
        `INSERT INTO meals
           (user_id, id, eaten_at, name, kcal, protein_g, carbs_g, fat_g, fiber_g,
            updated_at, deleted, server_version, accepted_op_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 1, $11)`,
        [
          userId,
          operation.meal.id,
          operation.meal.eatenAt,
          operation.meal.name,
          operation.meal.kcal,
          operation.meal.proteinG,
          operation.meal.carbsG,
          operation.meal.fatG,
          operation.meal.fiberG,
          operation.meal.updatedAt,
          operation.opId,
        ],
      );
      const record: MealRecord = {
        ...operation.meal,
        deleted: false,
        serverVersion: 1,
        acceptedOpId: operation.opId,
      };
      await appendChange(query, userId, record);
      return { opId: operation.opId, status: 'applied', record };
    }

    if (operation.meal.updatedAt > Number(existing.updated_at)) {
      const nextVersion = Number(existing.server_version) + 1;
      await query(
        `UPDATE meals
         SET eaten_at = $3, name = $4, kcal = $5, protein_g = $6, carbs_g = $7,
             fat_g = $8, fiber_g = $9, updated_at = $10, deleted = false,
             server_version = $11, accepted_op_id = $12
         WHERE user_id = $1 AND id = $2`,
        [
          userId,
          operation.recordId,
          operation.meal.eatenAt,
          operation.meal.name,
          operation.meal.kcal,
          operation.meal.proteinG,
          operation.meal.carbsG,
          operation.meal.fatG,
          operation.meal.fiberG,
          operation.meal.updatedAt,
          nextVersion,
          operation.opId,
        ],
      );
      const record: MealRecord = {
        ...operation.meal,
        deleted: false,
        serverVersion: nextVersion,
        acceptedOpId: operation.opId,
      };
      await appendChange(query, userId, record);
      return { opId: operation.opId, status: 'applied', record };
    }

    // Older upsert: no write, the current record wins.
    return { opId: operation.opId, status: 'applied', record: toRecord(existing) };
  }

  // Tombstone.
  if (existing === undefined) {
    // The record never reached this server: synthesise a deleted record so
    // every device converges through pull (and every schema stays valid).
    const record: MealRecord = {
      id: operation.recordId,
      eatenAt: '1970-01-01T00:00:00.000Z',
      name: '',
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      updatedAt: operation.clientTimestamp,
      deleted: true,
      serverVersion: 1,
      acceptedOpId: operation.opId,
    };
    await query(
      `INSERT INTO meals
         (user_id, id, eaten_at, name, kcal, protein_g, carbs_g, fat_g, fiber_g,
          updated_at, deleted, server_version, accepted_op_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 1, $11)`,
      [
        userId,
        operation.recordId,
        record.eatenAt,
        record.name,
        record.kcal,
        record.proteinG,
        record.carbsG,
        record.fatG,
        record.fiberG,
        record.updatedAt,
        operation.opId,
      ],
    );
    await appendChange(query, userId, record);
    return { opId: operation.opId, status: 'applied', record };
  }

  const stored = toRecord(existing);
  if (operation.clientTimestamp >= stored.updatedAt) {
    // Not older than the stored row: the tombstone wins.
    const nextVersion = stored.serverVersion + 1;
    await query(
      `UPDATE meals
       SET deleted = true, updated_at = $3, server_version = $4, accepted_op_id = $5
       WHERE user_id = $1 AND id = $2`,
      [userId, operation.recordId, operation.clientTimestamp, nextVersion, operation.opId],
    );
    const record: MealRecord = {
      ...stored,
      deleted: true,
      updatedAt: operation.clientTimestamp,
      serverVersion: nextVersion,
      acceptedOpId: operation.opId,
    };
    await appendChange(query, userId, record);
    return { opId: operation.opId, status: 'applied', record };
  }

  // Older tombstone loses; the current record wins.
  return { opId: operation.opId, status: 'applied', record: stored };
}

export function registerSyncRoutes(app: Hono<AppEnv>, store: SyncStoreApi): void {
  app.post(
    '/v1/sync/push',
    zValidator('json', PushRequestSchema, (result, c) =>
      result.success ? undefined : invalidRequest(c, result.error),
    ),
    async (c) => {
      const userId = c.get('userId');
      const { operations } = c.req.valid('json');
      const accepted = await store.transaction(async (query) => {
        const results: Array<{ opId: string; status: 'applied' | 'duplicate'; record: MealRecord }> = [];
        for (const operation of operations) {
          results.push(await processPushOperation(query, userId, operation));
        }
        return results;
      });
      return c.json({ accepted }, 200);
    },
  );

  app.post(
    '/v1/sync/pull',
    zValidator('json', PullRequestSchema, (result, c) =>
      result.success ? undefined : invalidRequest(c, result.error),
    ),
    async (c) => {
      const userId = c.get('userId');
      const { cursor, limit } = c.req.valid('json');
      // Fetch one extra row to decide `hasMore` without a second query.
      const rows = await store.query(
        `SELECT seq::int AS seq, record
         FROM sync_changes
         WHERE user_id = $1 AND seq > $2
         ORDER BY seq
         LIMIT $3`,
        [userId, cursor, limit + 1],
      );
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page.at(-1);
      return c.json(
        {
          rows: page.map((row) => {
            // postgres.js hands jsonb back as a string, PGlite as an object —
            // normalise so the wire always carries the record object.
            const raw = row.record;
            const record = typeof raw === 'string' ? (JSON.parse(raw) as MealRecord) : (raw as MealRecord);
            return { seq: Number(row.seq), record };
          }),
          cursor: last === undefined ? cursor : Number(last.seq),
          hasMore,
        },
        200,
      );
    },
  );
}
