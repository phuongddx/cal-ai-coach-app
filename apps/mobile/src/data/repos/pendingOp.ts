/**
 * PendingOp.swift — one un-acked local operation (the outbox row).
 */
export interface PendingOp {
  opId: string;
  tableName: string;
  recordId: string;
  /** 'upsert' | 'tombstone'. */
  kind: string;
  /** JSON mirror snapshot (id, displayText, deletedAt, serverVersion, acceptedOpId). */
  snapshot: string;
  clientTimestamp: Date;
  createdAt: Date;
  dispatchAttempts: number;
  nextRetryAt: Date | null;
  quarantined: boolean;
}

export function makePendingOp(
  op: Pick<PendingOp, 'opId' | 'tableName' | 'recordId' | 'kind' | 'snapshot'> &
    Partial<Pick<PendingOp, 'clientTimestamp' | 'createdAt' | 'dispatchAttempts' | 'nextRetryAt' | 'quarantined'>>,
): PendingOp {
  return {
    clientTimestamp: new Date(NaN),
    createdAt: new Date(NaN),
    dispatchAttempts: 0,
    nextRetryAt: null,
    quarantined: false,
    ...op,
  };
}
