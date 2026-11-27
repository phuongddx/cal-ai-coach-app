import { SyncOperationSchema } from '@coachcal/api-contract';

import { getRandomValues } from '../../__mocks__/expo-crypto';
import { newUuid } from './uuid';

describe('newUuid', () => {
  it('builds a contract-valid v4 UUID from the secure source (the Hermes case: no global crypto)', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = newUuid();
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

  it('takes its 16 bytes from expo-crypto getRandomValues, never from Math.random', () => {
    const math = jest.spyOn(Math, 'random');
    getRandomValues.mockClear();
    newUuid();
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(getRandomValues.mock.calls[0]?.[0]).toHaveLength(16);
    expect(math).not.toHaveBeenCalled();
    math.mockRestore();
  });

  it('sets the version and variant bits on whatever the source gives', () => {
    const id = newUuid((bytes) => bytes.fill(0xff));
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(newUuid((bytes) => bytes.fill(0))).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('throws when the secure source fails instead of falling back to a weaker one', () => {
    expect(() =>
      newUuid(() => {
        throw new Error('no secure random');
      }),
    ).toThrow('no secure random');
  });

  it('gives different ids', () => {
    expect(newUuid()).not.toBe(newUuid());
  });
});
