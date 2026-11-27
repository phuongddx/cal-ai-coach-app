import { SyncOperationSchema } from '@coachcal/api-contract';

import { newUuid } from './uuid';

describe('newUuid', () => {
  it('builds a contract-valid v4 UUID without randomUUID (the Hermes case)', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = newUuid({});
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const parsed = SyncOperationSchema.safeParse({
        opId: id,
        recordId: id,
        kind: 'tombstone',
        clientTimestamp: 1,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('uses getRandomValues when it is there', () => {
    const id = newUuid({
      getRandomValues: (bytes) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('prefers the native randomUUID', () => {
    expect(newUuid({ randomUUID: () => 'native-id' })).toBe('native-id');
  });

  it('gives different ids', () => {
    expect(newUuid({})).not.toBe(newUuid({}));
  });
});
