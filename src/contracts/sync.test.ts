import {
  SyncOperationSchema,
  PushRequestSchema,
  PushResponseSchema,
  PullRequestSchema,
  PullResponseSchema,
  compareCanonicalVersions,
  type CanonicalRowVersion,
} from './sync';

describe('SyncOperationSchema', () => {
  const validOperation = {
    opId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
    table: 'diary_entries',
    recordId: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    kind: 'upsert',
    snapshot: {
      id: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
      displayText: 'Chicken rice bowl',
      deletedAt: null,
      serverVersion: 0,
      acceptedOpId: null,
    },
    clientTimestamp: '2026-09-12T00:00:00.000Z',
  };

  it('accepts a valid upsert operation', () => {
    expect(() => SyncOperationSchema.parse(validOperation)).not.toThrow();
  });

  it('accepts a tombstone operation', () => {
    const tombstone = {
      ...validOperation,
      kind: 'tombstone',
      snapshot: {
        ...validOperation.snapshot,
        deletedAt: '2026-09-12T01:00:00.000Z',
      },
    };
    expect(() => SyncOperationSchema.parse(tombstone)).not.toThrow();
  });

  it('rejects a client-supplied userId — ownership is server-derived', () => {
    const withUserId = { ...validOperation, userId: 'someone-else' };
    expect(() => SyncOperationSchema.parse(withUserId)).toThrow();
  });

  it('rejects an unknown table', () => {
    const unknownTable = { ...validOperation, table: 'scan_results' };
    expect(() => SyncOperationSchema.parse(unknownTable)).toThrow();
  });

  it('rejects a malformed opId', () => {
    const badOpId = { ...validOperation, opId: 'not-a-uuid' };
    expect(() => SyncOperationSchema.parse(badOpId)).toThrow();
  });

  it('rejects an unknown mutation kind', () => {
    const badKind = { ...validOperation, kind: 'delete-forever' };
    expect(() => SyncOperationSchema.parse(badKind)).toThrow();
  });

  it('rejects a snapshot missing required fields', () => {
    const missingFields = {
      ...validOperation,
      snapshot: { id: validOperation.snapshot.id },
    };
    expect(() => SyncOperationSchema.parse(missingFields)).toThrow();
  });

  it('rejects duplicate ids inside one push request', () => {
    const duplicate = {
      cursor: 0,
      operations: [validOperation, validOperation],
    };
    expect(() => PushRequestSchema.parse(duplicate)).toThrow();
  });
});

describe('compareCanonicalVersions', () => {
  const version = (
    serverVersion: number,
    acceptedOpId: string
  ): CanonicalRowVersion => ({ serverVersion, acceptedOpId });

  it('prefers the higher serverVersion regardless of opId order', () => {
    const low = version(1, 'zzzzzzzz-0000-4000-8000-00000000000a');
    const high = version(2, 'aaaaaaa-0000-4000-8000-00000000000b');
    expect(compareCanonicalVersions(low, high)).toBe(high);
    expect(compareCanonicalVersions(high, low)).toBe(high);
  });

  it('breaks ties lexicographically by acceptedOpId deterministically', () => {
    const a = version(1, '11111111-1111-4111-8111-111111111111');
    const b = version(1, '22222222-2222-4222-8222-222222222222');
    expect(compareCanonicalVersions(a, b)).toBe(b);
    expect(compareCanonicalVersions(b, a)).toBe(b);
  });

  it('returns the same winner value for identical versions in either argument order', () => {
    const same = version(3, '33333333-3333-4333-8333-333333333333');
    expect(compareCanonicalVersions(same, { ...same })).toStrictEqual(same);
    expect(compareCanonicalVersions({ ...same }, same)).toStrictEqual(same);
  });
});

describe('Push and Pull envelopes', () => {
  it('push response acknowledges accepted operations with canonical versions', () => {
    const response = {
      accepted: [
        {
          opId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
          serverVersion: 7,
          acceptedOpId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
          duplicate: false,
        },
      ],
    };
    expect(() => PushResponseSchema.parse(response)).not.toThrow();
  });

  it('push response rejects an acknowledgement missing its canonical version', () => {
    const incomplete = {
      accepted: [{ opId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e' }],
    };
    expect(() => PushResponseSchema.parse(incomplete)).toThrow();
  });

  it('pull request rejects a negative cursor', () => {
    expect(() => PullRequestSchema.parse({ cursor: -1 })).toThrow();
  });

  it('pull response carries rows with canonical versions and tombstones', () => {
    const response = {
      rows: [
        {
          table: 'diary_entries',
          recordId: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
          snapshot: {
            id: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
            displayText: 'Oatmeal',
            deletedAt: null,
            serverVersion: 4,
            acceptedOpId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
          },
        },
      ],
      cursor: 4,
    };
    expect(() => PullResponseSchema.parse(response)).not.toThrow();
  });

  it('pull response rejects a cursor below the highest delivered version', () => {
    const inconsistent = {
      rows: [
        {
          table: 'diary_entries',
          recordId: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
          snapshot: {
            id: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
            displayText: 'Oatmeal',
            deletedAt: null,
            serverVersion: 9,
            acceptedOpId: '5b1f6a1e-9c2d-4a7b-8e3f-1d2c3b4a5f6e',
          },
        },
      ],
      cursor: 4,
    };
    expect(() => PullResponseSchema.parse(inconsistent)).toThrow();
  });
});
