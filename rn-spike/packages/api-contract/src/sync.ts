/**
 * Offline-first sync wire contracts (spec D4, spike item 4).
 *
 * Shared by the RN app (`apps/mobile`) and the Hono API (`apps/api`). Names
 * follow the existing Swift (`SyncEnvelope.swift`) and web (`web/core.js`)
 * contracts so learnings transfer. Every object is `strictObject`: unknown keys
 * are rejected on both ends.
 *
 * The VLM-style kcal rule does not apply here; the client's `updatedAt` (integer
 * ms wall clock at the edit) is the LWW clock for the whole record.
 */
import { z } from 'zod';

/** Shared meal fields; composed so `Meal` and `MealRecord` stay strictly separate objects. */
const MealFields = {
  id: z.uuid(),
  /** ISO-8601 instant. */
  eatenAt: z.iso.datetime(),
  name: z.string().max(200),
  kcal: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0),
  /** Client wall clock at the edit, integer ms — the LWW clock. */
  updatedAt: z.number().int().min(0),
} as const;

export const MealSchema = z.strictObject(MealFields);

/** A meal as the server stores and returns it. */
export const MealRecordSchema = z.strictObject({
  ...MealFields,
  deleted: z.boolean(),
  serverVersion: z.number().int().min(1),
  acceptedOpId: z.uuid().nullable(),
});

const OperationFields = {
  /** Idempotency key: the same `opId` twice answers `duplicate` and writes nothing. */
  opId: z.uuid(),
  recordId: z.uuid(),
  /** Client wall clock when the operation was enqueued, integer ms. */
  clientTimestamp: z.number().int().min(0),
} as const;

/**
 * `meal` is required for an upsert and rejected on a tombstone: the union arms
 * are strict, so a tombstone carrying `meal` fails on the unknown key.
 */
export const SyncOperationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...OperationFields, kind: z.literal('upsert'), meal: MealSchema }),
  z.strictObject({ ...OperationFields, kind: z.literal('tombstone') }),
]);

export const PushRequestSchema = z.strictObject({
  operations: z.array(SyncOperationSchema).min(1).max(50),
});

export const PushResponseSchema = z.strictObject({
  accepted: z.array(
    z.strictObject({
      opId: z.uuid(),
      status: z.enum(['applied', 'duplicate']),
      /** The server's current record, so the client converges. */
      record: MealRecordSchema,
    }),
  ),
});

export const PullRequestSchema = z.strictObject({
  cursor: z.number().int().min(0),
  limit: z.number().int().min(1).max(500).default(200),
});

export const PullResponseSchema = z.strictObject({
  rows: z.array(
    z.strictObject({
      seq: z.number().int().min(1),
      record: MealRecordSchema,
    }),
  ),
  /** The cursor the client should send next. */
  cursor: z.number().int().min(0),
  /** True only when more rows exist beyond this page. */
  hasMore: z.boolean(),
});

export type Meal = z.infer<typeof MealSchema>;
export type MealRecord = z.infer<typeof MealRecordSchema>;
export type SyncOperation = z.infer<typeof SyncOperationSchema>;
export type PushRequest = z.infer<typeof PushRequestSchema>;
export type PushResponse = z.infer<typeof PushResponseSchema>;
export type PullRequest = z.infer<typeof PullRequestSchema>;
export type PullResponse = z.infer<typeof PullResponseSchema>;
