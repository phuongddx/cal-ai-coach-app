import {
  compareCanonicalVersions,
  type CanonicalRowVersion,
} from '../../contracts/sync';

/**
 * Single ordering seam for the sync engine. All LWW decisions — server apply
 * guard, client merge, acknowledgement canonical bump — delegate here so the
 * comparator contract has exactly one implementation (Plan 01-02 contract).
 */

export function canonicalOf(
  serverVersion: number,
  acceptedOpId: string | null
): CanonicalRowVersion {
  return { serverVersion, acceptedOpId: acceptedOpId ?? '' };
}

/** True when `candidate` is strictly newer than `incumbent` under the canonical comparator. */
export function isNewerCanonical(
  candidate: CanonicalRowVersion,
  incumbent: CanonicalRowVersion
): boolean {
  return compareCanonicalVersions(candidate, incumbent) === candidate &&
    !canonicalEquals(candidate, incumbent);
}

export function canonicalEquals(
  a: CanonicalRowVersion,
  b: CanonicalRowVersion
): boolean {
  return a.serverVersion === b.serverVersion && a.acceptedOpId === b.acceptedOpId;
}
