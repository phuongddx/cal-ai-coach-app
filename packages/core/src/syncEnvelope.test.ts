import {
  createPushRequest,
  decodeDiaryEntrySnapshot,
  formatSyncDate,
  parseSyncDate,
  rejectUnknownKeys,
  validateAcknowledgementSet,
  validatePullResponse,
} from './syncEnvelope';

import type { PushAcknowledgement, PushRequest, SyncOperation, SyncTransport } from './syncEnvelope';

const SNAPSHOT_ID = 'B07537F5-5709-45FA-B4C6-20CB5F0F1A1F';
const RECORD_ID = '40604E0E-D515-4AC1-B4F8-79B83FA4B740';
const CLIENT_TIMESTAMP = formatSyncDate(new Date(1_768_300_000 * 1000));

function makeSnapshotJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SNAPSHOT_ID,
    displayText: 'Oatmeal',
    deletedAt: null,
    serverVersion: 7,
    acceptedOpId: null,
    ...overrides,
  };
}

function makeSnapshot() {
  return {
    id: SNAPSHOT_ID,
    displayText: 'Oatmeal',
    deletedAt: null,
    serverVersion: 7,
    acceptedOpId: null,
  };
}

function makeOperation(opId = '11111111-2222-4333-8444-555555555555'): SyncOperation {
  return {
    opId,
    table: 'diary_entries',
    recordId: RECORD_ID,
    kind: 'upsert',
    snapshot: makeSnapshot(),
    clientTimestamp: CLIENT_TIMESTAMP,
  };
}

function ack(opId: string): PushAcknowledgement {
  return { opId, serverVersion: 1, acceptedOpId: opId, duplicate: false };
}

class FakeTransport implements SyncTransport {
  async push(request: PushRequest) {
    return { accepted: request.operations.map((op) => ack(op.opId)) };
  }

  async pull(cursor: number) {
    return { rows: [], cursor };
  }
}

describe('SyncEnvelope strict rules', () => {
  it('snapshot requires every key and rejects unknown keys', () => {
    const { displayText: _dropped, ...missingDisplay } = makeSnapshotJson();
    expect(() => decodeDiaryEntrySnapshot(missingDisplay)).toThrow('Missing displayText');

    const { acceptedOpId: _droppedToo, ...missingAccepted } = makeSnapshotJson();
    expect(() => decodeDiaryEntrySnapshot(missingAccepted)).toThrow('Missing acceptedOpId');

    const unknownUser = makeSnapshotJson({ userId: 'foreign' });
    expect(() => decodeDiaryEntrySnapshot(unknownUser)).toThrow('Unknown sync envelope keys: userId');

    const offset = '2026-09-13T14:37:00+07:00';
    const decoded = decodeDiaryEntrySnapshot(makeSnapshotJson({ deletedAt: offset }));
    expect(parseSyncDate(String(decoded.deletedAt)).getTime()).toBe(new Date(offset).getTime());
  });

  it('push response acknowledgement set must match submitted operations exactly', () => {
    const firstOp = '41BCA976-477B-4405-8523-2C6F98E2B4F7';
    const secondOp = '2947D66A-F80B-42DA-8951-679B9B2A5D48';
    const operations = [makeOperation(firstOp), makeOperation(secondOp)];

    expect(() => validateAcknowledgementSet(operations, [ack(firstOp), ack(secondOp)])).not.toThrow();
    expect(() =>
      validateAcknowledgementSet(operations, [ack(firstOp), ack(secondOp), ack(secondOp)]),
    ).toThrow('Push response acknowledges operation 2947D66A-F80B-42DA-8951-679B9B2A5D48 more than once');
    expect(() => validateAcknowledgementSet(operations, [ack(firstOp)])).toThrow(
      'Push response acknowledges 1 of 2 submitted operations; refusing a partial acknowledgement set',
    );
    expect(() => validateAcknowledgementSet([makeOperation(firstOp)], [ack(firstOp), ack(secondOp)])).toThrow(
      `Push response acknowledges unsent operation ${secondOp}`,
    );
  });

  it('push request requires non-empty unique operations and round trips', () => {
    const duplicateOperation = makeOperation();
    expect(() => createPushRequest([])).toThrow('Push batch must not be empty');
    expect(() => createPushRequest([duplicateOperation, duplicateOperation])).toThrow(
      'Push batch must not repeat an opId',
    );

    const operations = [makeOperation()];
    const request = createPushRequest(operations);
    const decoded = JSON.parse(JSON.stringify(request)) as typeof request;
    expect(decoded).toEqual(request);
    expect(decoded.operations).toEqual(operations);
  });

  it('sync transport surface is available and sendable', async () => {
    const transport: SyncTransport = new FakeTransport();
    const response = await transport.push(createPushRequest([makeOperation()]));
    const pulled = await transport.pull(0);
    expect(response.accepted).toHaveLength(1);
    expect(pulled.rows).toHaveLength(0);
  });

  it('pull cursor must be non-negative and at least the highest delivered server version', () => {
    const row = {
      table: 'diary_entries' as const,
      recordId: RECORD_ID,
      snapshot: { ...makeSnapshot(), serverVersion: 9 },
    };
    expect(() => validatePullResponse({ rows: [row], cursor: -1 })).toThrow(
      'Pull cursor must be non-negative',
    );
    expect(() => validatePullResponse({ rows: [row], cursor: 8 })).toThrow(
      'Pull cursor must be at least the highest delivered serverVersion',
    );
    expect(() => validatePullResponse({ rows: [row], cursor: 9 })).not.toThrow();
    expect(() => validatePullResponse({ rows: [], cursor: 0 })).not.toThrow();
  });

  it('date codec accepts fractional-second and plain ISO-8601 offsets and rejects the rest', () => {
    expect(parseSyncDate('2026-09-13T14:37:00+07:00').getTime()).toBe(
      Date.parse('2026-09-13T14:37:00+07:00'),
    );
    expect(parseSyncDate('2026-09-13T14:37:00.123+07:00').getTime()).toBe(
      Date.parse('2026-09-13T14:37:00.123+07:00'),
    );
    const instant = Date.UTC(2026, 0, 13, 9, 46, 40);
    expect(parseSyncDate(formatSyncDate(new Date(instant))).getTime()).toBe(instant);
    expect(formatSyncDate(new Date(instant))).toBe('2026-01-13T09:46:40Z');
    expect(() => parseSyncDate('Sept 5, 2026')).toThrow('Invalid ISO-8601 offset date: Sept 5, 2026');
  });

  it('unknown keys are reported sorted and comma joined', () => {
    expect(() => rejectUnknownKeys(['zeta', 'alpha'], ['id'])).toThrow(
      'Unknown sync envelope keys: alpha, zeta',
    );
    expect(() => rejectUnknownKeys(['id', 'displayText'], ['id', 'displayText'])).not.toThrow();
  });
});
