import Foundation

/// Deterministic last-writer-wins ordering used by every local merge path.
///
/// Higher server versions win; equal versions break ties lexicographically by
/// the server-assigned operation ID. Identical values intentionally return the
/// first argument to preserve the original call-site value.
public func compareCanonicalVersions(
  _ first: CanonicalRowVersion,
  _ second: CanonicalRowVersion
) -> CanonicalRowVersion {
  if first.serverVersion != second.serverVersion {
    return first.serverVersion > second.serverVersion ? first : second
  }

  let firstID = first.acceptedOpId.uuidString
  let secondID = second.acceptedOpId.uuidString
  guard firstID != secondID else { return first }
  return firstID > secondID ? first : second
}
