import { compareCanonicalVersions } from './canonicalVersion';

import type { CanonicalRowVersion } from './canonicalVersion';

function permutations<T>(items: T[]): T[][] {
  if (items.length === 0) return [[]];
  const result: T[][] = [];
  items.forEach((head, index) => {
    const remainder = items.slice(0, index).concat(items.slice(index + 1));
    for (const tail of permutations(remainder)) {
      result.push([head, ...tail]);
    }
  });
  return result;
}

describe('compareCanonicalVersions', () => {
  const version = (serverVersion: number, acceptedOpId: string): CanonicalRowVersion => ({
    serverVersion,
    acceptedOpId,
  });

  it('higher server version wins regardless of op ID', () => {
    const lowOp = 'FFFFFFFF-0000-0000-0000-000000000000';
    const highOp = '00000000-0000-0000-0000-000000000001';
    const low = version(1, lowOp);
    const high = version(2, highOp);

    expect(compareCanonicalVersions(low, high)).toEqual(high);
    expect(compareCanonicalVersions(high, low)).toEqual(high);
  });

  it('equal server versions break ties lexicographically by op ID', () => {
    const lower = '00000000-0000-0000-0000-000000000001';
    const higher = '00000000-0000-0000-0000-000000000002';
    const a = version(7, lower);
    const b = version(7, higher);

    expect(compareCanonicalVersions(a, b)).toEqual(b);
    expect(compareCanonicalVersions(b, a)).toEqual(b);
  });

  it('identical versions return the first argument', () => {
    const first = version(9, '00000000-0000-0000-0000-000000000007');
    const sameValueButDistinct = { ...first };

    expect(compareCanonicalVersions(first, sameValueButDistinct)).toBe(first);
  });

  it('every delivery order converges to the same winner', () => {
    const accepted: CanonicalRowVersion[] = [
      version(1, '00000000-0000-0000-0000-000000000004'),
      version(3, '00000000-0000-0000-0000-000000000001'),
      version(2, '00000000-0000-0000-0000-000000000009'),
      version(3, '00000000-0000-0000-0000-000000000008'),
    ];
    const expected = accepted.reduce(compareCanonicalVersions);

    for (const permutation of permutations(accepted)) {
      const winner = permutation.reduce(compareCanonicalVersions);
      expect(winner).toEqual(expected);
    }
  });
});
