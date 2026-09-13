import Foundation
import Testing

@testable import CoachCalCore

@Suite
struct LWWComparatorTests {
  private func version(_ serverVersion: Int, _ opId: UUID) -> CanonicalRowVersion {
    CanonicalRowVersion(serverVersion: serverVersion, acceptedOpId: opId)
  }

  @Test
  func higherServerVersionWinsRegardlessOfOpID() {
    let lowOp = UUID(uuidString: "FFFFFFFF-0000-0000-0000-000000000000")!
    let highOp = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    let low = version(1, lowOp)
    let high = version(2, highOp)

    #expect(compareCanonicalVersions(low, high) == high)
    #expect(compareCanonicalVersions(high, low) == high)
  }

  @Test
  func equalServerVersionsBreakTiesLexicographicallyByOpID() {
    let lower = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    let higher = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    let a = version(7, lower)
    let b = version(7, higher)

    #expect(compareCanonicalVersions(a, b) == b)
    #expect(compareCanonicalVersions(b, a) == b)
  }

  @Test
  func identicalVersionsReturnTheFirstArgument() {
    let op = UUID()
    let first = version(9, op)

    #expect(compareCanonicalVersions(first, first) == first)
  }

  @Test
  func everyDeliveryOrderConvergesToTheSameWinner() throws {
    let accepted = [
      CanonicalRowVersion(
        serverVersion: 1,
        acceptedOpId: UUID(uuidString: "00000000-0000-0000-0000-000000000004")!
      ),
      CanonicalRowVersion(
        serverVersion: 3,
        acceptedOpId: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
      ),
      CanonicalRowVersion(
        serverVersion: 2,
        acceptedOpId: UUID(uuidString: "00000000-0000-0000-0000-000000000009")!
      ),
      CanonicalRowVersion(
        serverVersion: 3,
        acceptedOpId: UUID(uuidString: "00000000-0000-0000-0000-000000000008")!
      ),
    ]
    let expected = accepted.reduce(accepted[0], compareCanonicalVersions)

    for permutation in accepted.permutations() {
      let winner = permutation.reduce(permutation[0], compareCanonicalVersions)
      #expect(winner == expected)
    }
  }
}

private extension Array {
  func permutations() -> [[Element]] {
    guard !isEmpty else { return [[]] }
    var result: [[Element]] = []
    for index in indices {
      var remainder = self
      let head = remainder.remove(at: index)
      for tail in remainder.permutations() {
        result.append([head] + tail)
      }
    }
    return result
  }
}
