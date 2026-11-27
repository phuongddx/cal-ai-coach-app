/**
 * CanonicalVersion.swift — deterministic last-writer-wins ordering used by
 * every local merge path.
 *
 * Higher server versions win; equal versions break ties lexicographically by
 * the server-assigned operation ID (compared on the canonical uppercase form,
 * as Swift's `uuidString` renders it). Identical values intentionally return
 * the first argument to preserve the original call-site value.
 */
export interface CanonicalRowVersion {
  serverVersion: number;
  acceptedOpId: string;
}

export function compareCanonicalVersions(
  first: CanonicalRowVersion,
  second: CanonicalRowVersion,
): CanonicalRowVersion {
  if (first.serverVersion !== second.serverVersion) {
    return first.serverVersion > second.serverVersion ? first : second;
  }

  const firstID = first.acceptedOpId.toUpperCase();
  const secondID = second.acceptedOpId.toUpperCase();
  if (firstID === secondID) {
    return first;
  }
  return firstID > secondID ? first : second;
}
