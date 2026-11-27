/**
 * A fake server-side sync endpoint for the engine tests. It implements the
 * D4 semantics (LWW on `updatedAt`, idempotency ledger on `opId`, a seq'd
 * change log) so the tests exercise real convergence behaviour — the same
 * rules the real Hono API enforces.
 */
import type { MealRecord, PullResponse, PushResponse, SyncOperation } from '@coachcal/api-contract';

import { SyncError, type SyncTransport } from './types';

const epochRecord = (recordId: string, op: SyncOperation): MealRecord => ({
  id: recordId,
  eatenAt: '1970-01-01T00:00:00.000Z',
  name: '',
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  updatedAt: op.clientTimestamp,
  deleted: true,
  serverVersion: 1,
  acceptedOpId: op.opId,
});

export class FakeServer implements SyncTransport {
  readonly records = new Map<string, MealRecord>();
  private readonly seenOps = new Set<string>();
  private readonly changes: Array<{ seq: number; record: MealRecord }> = [];
  private seqCounter = 0;
  pushCalls = 0;
  pullCalls = 0;
  /** When set, the next push rejects with it (then the error is cleared). */
  pushError: SyncError | null = null;
  pullError: SyncError | null = null;

  /** Seeds the server as if another device had pushed this record. */
  seed(record: MealRecord): void {
    this.records.set(record.id, record);
    this.seqCounter += 1;
    this.changes.push({ seq: this.seqCounter, record });
  }

  private applyOperation(op: SyncOperation): PushResponse['accepted'][number] {
    if (this.seenOps.has(op.opId)) {
      const current = this.records.get(op.recordId);
      if (current === undefined) throw new Error('fake server: seen op without record');
      return { opId: op.opId, status: 'duplicate', record: current };
    }
    this.seenOps.add(op.opId);

    const stored = this.records.get(op.recordId);
    let record: MealRecord;
    if (op.kind === 'upsert') {
      if (stored === undefined) {
        record = { ...op.meal, deleted: false, serverVersion: 1, acceptedOpId: op.opId };
      } else if (op.meal.updatedAt > stored.updatedAt) {
        record = { ...op.meal, deleted: false, serverVersion: stored.serverVersion + 1, acceptedOpId: op.opId };
      } else {
        record = stored;
      }
    } else {
      if (stored === undefined) {
        record = epochRecord(op.recordId, op);
      } else if (op.clientTimestamp >= stored.updatedAt) {
        record = { ...stored, deleted: true, updatedAt: op.clientTimestamp, serverVersion: stored.serverVersion + 1, acceptedOpId: op.opId };
      } else {
        record = stored;
      }
    }

    if (record !== stored) {
      this.records.set(record.id, record);
      this.seqCounter += 1;
      this.changes.push({ seq: this.seqCounter, record });
    }
    return { opId: op.opId, status: 'applied', record };
  }

  async push(operations: SyncOperation[]): Promise<PushResponse> {
    this.pushCalls += 1;
    if (this.pushError !== null) {
      const error = this.pushError;
      this.pushError = null;
      throw error;
    }
    return { accepted: operations.map((op) => this.applyOperation(op)) };
  }

  async pull(cursor: number, limit: number): Promise<PullResponse> {
    this.pullCalls += 1;
    if (this.pullError !== null) {
      const error = this.pullError;
      this.pullError = null;
      throw error;
    }
    const after = this.changes.filter((change) => change.seq > cursor);
    const page = after.slice(0, limit);
    return {
      rows: page.map((change) => ({ seq: change.seq, record: change.record })),
      cursor: page.length > 0 ? page[page.length - 1].seq : cursor,
      hasMore: after.length > page.length,
    };
  }
}
