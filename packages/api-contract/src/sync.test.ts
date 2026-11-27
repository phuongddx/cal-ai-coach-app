import {
  MealRecordSchema,
  MealSchema,
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  PushResponseSchema,
  SyncOperationSchema,
} from './sync';

const MEAL = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eatenAt: '2026-11-27T01:00:00.000Z',
  name: 'Overnight oats',
  kcal: 320,
  proteinG: 12,
  carbsG: 45,
  fatG: 9,
  fiberG: 6,
  updatedAt: 1_764_200_400_000,
};

const MEAL_RECORD = {
  ...MEAL,
  deleted: false,
  serverVersion: 1,
  acceptedOpId: '11111111-1111-4111-8111-111111111111',
};

const upsertOp = {
  opId: '22222222-2222-4222-8222-222222222222',
  recordId: MEAL.id,
  kind: 'upsert' as const,
  meal: MEAL,
  clientTimestamp: MEAL.updatedAt,
};

describe('MealSchema', () => {
  it('accepts a valid meal', () => {
    expect(MealSchema.parse(MEAL)).toEqual(MEAL);
  });

  it('rejects an unknown key', () => {
    expect(MealSchema.safeParse({ ...MEAL, grams: 300 }).success).toBe(false);
  });

  it('rejects a name over 200 characters', () => {
    expect(MealSchema.safeParse({ ...MEAL, name: 'x'.repeat(201) }).success).toBe(false);
    expect(MealSchema.safeParse({ ...MEAL, name: 'x'.repeat(200) }).success).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(MealSchema.safeParse({ ...MEAL, kcal: -1 }).success).toBe(false);
    expect(MealSchema.safeParse({ ...MEAL, proteinG: -0.5 }).success).toBe(false);
    expect(MealSchema.safeParse({ ...MEAL, fatG: -10 }).success).toBe(false);
  });

  it('rejects a non-integer updatedAt and a non-ISO eatenAt', () => {
    expect(MealSchema.safeParse({ ...MEAL, updatedAt: 1.5 }).success).toBe(false);
    expect(MealSchema.safeParse({ ...MEAL, eatenAt: 'yesterday' }).success).toBe(false);
    expect(MealSchema.safeParse({ ...MEAL, id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('MealRecordSchema', () => {
  it('accepts a record with a null acceptedOpId', () => {
    expect(MealRecordSchema.parse({ ...MEAL_RECORD, acceptedOpId: null })).toEqual({
      ...MEAL_RECORD,
      acceptedOpId: null,
    });
  });

  it('rejects serverVersion below 1 and an unknown key', () => {
    expect(MealRecordSchema.safeParse({ ...MEAL_RECORD, serverVersion: 0 }).success).toBe(false);
    expect(MealRecordSchema.safeParse({ ...MEAL_RECORD, seq: 3 }).success).toBe(false);
  });
});

describe('SyncOperationSchema', () => {
  it('accepts an upsert with a meal and a bare tombstone', () => {
    expect(SyncOperationSchema.parse(upsertOp)).toEqual(upsertOp);
    const tombstone = {
      opId: '33333333-3333-4333-8333-333333333333',
      recordId: MEAL.id,
      kind: 'tombstone' as const,
      clientTimestamp: 1_764_200_500_000,
    };
    expect(SyncOperationSchema.parse(tombstone)).toEqual(tombstone);
  });

  it('requires meal for an upsert', () => {
    const { meal: _meal, ...withoutMeal } = upsertOp;
    expect(SyncOperationSchema.safeParse(withoutMeal).success).toBe(false);
  });

  it('rejects a tombstone that carries a meal (strict unknown key)', () => {
    const tombstoneWithMeal = {
      opId: '33333333-3333-4333-8333-333333333333',
      recordId: MEAL.id,
      kind: 'tombstone' as const,
      clientTimestamp: 1_764_200_500_000,
      meal: MEAL,
    };
    expect(SyncOperationSchema.safeParse(tombstoneWithMeal).success).toBe(false);
  });

  it('rejects an unknown kind and unknown keys', () => {
    expect(
      SyncOperationSchema.safeParse({ ...upsertOp, kind: 'delete' }).success,
    ).toBe(false);
    expect(SyncOperationSchema.safeParse({ ...upsertOp, table: 'meals' }).success).toBe(false);
  });
});

describe('PushRequestSchema', () => {
  it('accepts 1..50 operations', () => {
    const one = { operations: [upsertOp] };
    expect(PushRequestSchema.safeParse(one).success).toBe(true);
    const fifty = { operations: Array.from({ length: 50 }, (_, i) => ({
      ...upsertOp,
      opId: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`,
    })) };
    expect(PushRequestSchema.safeParse(fifty).success).toBe(true);
  });

  it('rejects 0 and 51 operations', () => {
    expect(PushRequestSchema.safeParse({ operations: [] }).success).toBe(false);
    const fiftyOne = { operations: Array.from({ length: 51 }, (_, i) => ({
      ...upsertOp,
      opId: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
    })) };
    expect(PushRequestSchema.safeParse(fiftyOne).success).toBe(false);
  });

  it('rejects an unknown top-level key', () => {
    expect(PushRequestSchema.safeParse({ operations: [upsertOp], deviceId: 'x' }).success).toBe(false);
  });
});

describe('PushResponseSchema', () => {
  it('accepts applied and duplicate statuses with the server record', () => {
    const response = {
      accepted: [
        { opId: upsertOp.opId, status: 'applied' as const, record: MEAL_RECORD },
        { opId: '66666666-6666-4666-8666-666666666666', status: 'duplicate' as const, record: MEAL_RECORD },
      ],
    };
    expect(PushResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects an unknown status or an unknown key', () => {
    const bad = { accepted: [{ opId: upsertOp.opId, status: 'maybe', record: MEAL_RECORD }] };
    expect(PushResponseSchema.safeParse(bad).success).toBe(false);
    expect(PushResponseSchema.safeParse({ accepted: [], extra: 1 }).success).toBe(false);
  });
});

describe('PullRequestSchema', () => {
  it('accepts a cursor and defaults the limit to 200', () => {
    expect(PullRequestSchema.parse({ cursor: 0 })).toEqual({ cursor: 0, limit: 200 });
    expect(PullRequestSchema.safeParse({ cursor: 7, limit: 500 }).success).toBe(true);
  });

  it('rejects a negative cursor and out-of-range limits', () => {
    expect(PullRequestSchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(PullRequestSchema.safeParse({ cursor: 0, limit: 0 }).success).toBe(false);
    expect(PullRequestSchema.safeParse({ cursor: 0, limit: 501 }).success).toBe(false);
    expect(PullRequestSchema.safeParse({ cursor: 0, since: 3 }).success).toBe(false);
  });
});

describe('PullResponseSchema', () => {
  it('accepts rows with seq and records', () => {
    const response = { rows: [{ seq: 1, record: MEAL_RECORD }], cursor: 1, hasMore: false };
    expect(PullResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a seq below 1 and unknown keys', () => {
    const bad = { rows: [{ seq: 0, record: MEAL_RECORD }], cursor: 0, hasMore: false };
    expect(PullResponseSchema.safeParse(bad).success).toBe(false);
    expect(PullResponseSchema.safeParse({ rows: [], cursor: 0, hasMore: false }).success).toBe(true);
    expect(PullResponseSchema.safeParse({ rows: [], cursor: 0, hasMore: false, extra: 1 }).success).toBe(false);
  });
});
