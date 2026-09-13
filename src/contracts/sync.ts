import { z } from 'zod';

/**
 * Phase 1 sync vocabulary — the ONLY shapes crossing the device↔server
 * boundary. Server-derived ownership: clients never send userId; the RPC
 * derives it from auth.uid(). Business nutrition/VLM fields are out of scope
 * for this phase and MUST NOT be added here without a coordinated contract
 * migration (see Plan 01-02 reversibility note).
 *
 * All object schemas are strict: unknown keys (e.g. a client-supplied userId,
 * future un-vetted fields) are rejected at the boundary, not silently carried.
 */

export const SYNCED_TABLES = ['diary_entries'] as const;
export const syncedTableSchema = z.enum(SYNCED_TABLES);
export type SyncedTable = z.infer<typeof syncedTableSchema>;

export const mutationKindSchema = z.enum(['upsert', 'tombstone']);
export type MutationKind = z.infer<typeof mutationKindSchema>;

export const DiaryEntrySnapshotSchema = z.strictObject({
  id: z.uuid(),
  /** Local display text (the Phase 1 walking-skeleton business field). */
  displayText: z.string(),
  /** Soft tombstone; null while the row is live. */
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  /** Canonical server acceptance order. Locally 0/null until acknowledged. */
  serverVersion: z.number().int().nonnegative(),
  acceptedOpId: z.uuid().nullable(),
});
export type DiaryEntrySnapshot = z.infer<typeof DiaryEntrySnapshotSchema>;

export const SyncOperationSchema = z.strictObject({
  /** Globally unique, immutable, client-generated operation identifier. */
  opId: z.uuid(),
  table: syncedTableSchema,
  recordId: z.uuid(),
  kind: mutationKindSchema,
  /** Full-row snapshot; the server never merges partial payloads. */
  snapshot: DiaryEntrySnapshotSchema,
  /** Diagnostic only — never used for ordering or conflict resolution. */
  clientTimestamp: z.iso.datetime({ offset: true }),
});
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const CanonicalRowVersionSchema = z.strictObject({
  serverVersion: z.number().int().nonnegative(),
  acceptedOpId: z.uuid(),
});
export type CanonicalRowVersion = z.infer<typeof CanonicalRowVersionSchema>;

export const PushRequestSchema = z.strictObject({
  operations: z
    .array(SyncOperationSchema)
    .min(1)
    .refine(
      (operations) =>
        new Set(operations.map((operation) => operation.opId)).size ===
        operations.length,
      'Push batch must not repeat an opId'
    ),
});
export type PushRequest = z.infer<typeof PushRequestSchema>;

export const PushAcknowledgementSchema = z.strictObject({
  opId: z.uuid(),
  serverVersion: z.number().int().nonnegative(),
  acceptedOpId: z.uuid(),
  /** True when the server had already accepted this opId (replay). */
  duplicate: z.boolean(),
});
export type PushAcknowledgement = z.infer<typeof PushAcknowledgementSchema>;

export const PushResponseSchema = z.strictObject({
  accepted: z.array(PushAcknowledgementSchema),
});
export type PushResponse = z.infer<typeof PushResponseSchema>;

/**
 * Request-bound acknowledgement validation (Plan 01-06, threat T-01-27).
 *
 * A push response may only acknowledge operations submitted in the request
 * that produced it. A shape-valid response naming an opId outside the frozen
 * submitted batch is hostile or defective — rejecting it whole keeps every
 * pending operation durable for retry. Envelope shape remains
 * PushResponseSchema's job; this is the request-correlation gate the
 * dispatcher runs before any acknowledgement transaction.
 */
export function assertAcknowledgementSet(
  operations: PushRequest['operations'],
  accepted: PushResponse['accepted']
): void {
  const submitted = new Set(operations.map((operation) => operation.opId));
  for (const ack of accepted) {
    if (!submitted.has(ack.opId)) {
      throw new Error(
        `Push response acknowledges unsent operation ${ack.opId}`
      );
    }
  }
}

export const PullRequestSchema = z.strictObject({
  /** Durable server cursor; the client pulls everything strictly newer. */
  cursor: z.number().int().nonnegative(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const PulledRowSchema = z.strictObject({
  table: syncedTableSchema,
  recordId: z.uuid(),
  snapshot: DiaryEntrySnapshotSchema,
});
export type PulledRow = z.infer<typeof PulledRowSchema>;

export const PullResponseSchema = z
  .strictObject({
    rows: z.array(PulledRowSchema),
    cursor: z.number().int().nonnegative(),
  })
  .refine(
    (response) =>
      response.rows.every(
        (row) => row.snapshot.serverVersion <= response.cursor
      ),
    'Pull cursor must be at least the highest delivered serverVersion'
  );
export type PullResponse = z.infer<typeof PullResponseSchema>;

/**
 * Deterministic canonical comparator: higher serverVersion wins; ties break
 * lexicographically by acceptedOpId; identical versions return the first
 * argument. Applying the same accepted rows in any delivery order converges
 * to the same winner — the Phase 1 LWW invariant.
 */
export function compareCanonicalVersions(
  a: CanonicalRowVersion,
  b: CanonicalRowVersion
): CanonicalRowVersion {
  if (a.serverVersion !== b.serverVersion) {
    return a.serverVersion > b.serverVersion ? a : b;
  }
  if (a.acceptedOpId !== b.acceptedOpId) {
    return a.acceptedOpId > b.acceptedOpId ? a : b;
  }
  return a;
}
