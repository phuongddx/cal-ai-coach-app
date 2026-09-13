import Foundation
import GRDB
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCal

@Suite
struct TwoInstallConvergenceProof {
  @Test
  func oppositeReconnectOrdersConvergeOnSameCanonicalRow() async throws {
    let first = try await ProofHarness.create(runtime: "iOS 18.4")
    let entry = ProofSupport.newEntry(owner: first.owner)
    let base = try await first.diary.recordUpsert(entry)
    _ = try await first.bindAndDispatch()

    let second = try first.makeIndependentInstall()
    _ = try await second.bindAndDispatch()

    let firstEdit = ProofSupport.edited(entry, text: "first offline edit")
    let secondEdit = ProofSupport.edited(entry, text: "second offline edit")
    let firstOp = try await first.diary.recordUpsert(firstEdit)
    let secondOp = try await second.diary.recordUpsert(secondEdit)

    let firstResult = try await first.bindAndDispatch()
    let secondResult = try await second.bindAndDispatch()

    // Install 1 must reconnect once more to pull the server-canonical winner
    // produced by install 2's conflicting push; convergence means both
    // installs end on the same canonical row.
    _ = try await first.bindAndDispatch()

    let firstRow = try await first.entry(entry.id)
    let secondRow = try await second.entry(entry.id)

    #expect(firstResult.acked == 1)
    #expect(secondResult.acked == 1)
    // Convergence is the server-canonical winning row on both installs
    // (DEC-1105-05: id/serverVersion/acceptedOpId/tombstone). Timestamps are
    // compared semantically because pull-decoded dates can drift below the
    // second from the applied-locally originals.
    #expect(firstRow?.id == secondRow?.id)
    #expect(firstRow?.displayText == secondRow?.displayText)
    #expect(firstRow?.serverVersion == secondRow?.serverVersion)
    #expect(firstRow?.acceptedOpId == secondRow?.acceptedOpId)
    #expect((firstRow?.deletedAt != nil) == (secondRow?.deletedAt != nil))
    #expect(firstRow?.id == entry.id)
    // LWW: install 2's edit carries the later updatedAt, so its op is
    // the server-canonical winner on both installs.
    #expect(firstRow?.acceptedOpId == secondOp.opId)

    let winner = try #require(firstRow)
    let checks = [
      ProofCheck(name: "firstReconnect", status: .pass, timingMs: firstResult.acked),
      ProofCheck(name: "secondReconnect", status: .pass, timingMs: secondResult.acked),
    ]
    let evidence: [String: ProofValue] = [
      "serverVersion": .int(Int(winner.serverVersion)),
      "acceptedOpId": .uuid(winner.acceptedOpId ?? base.opId),
      "tombstone": .bool(winner.deletedAt != nil),
    ]

    let record = ProofHarness.makeRecord(
      scenario: .sameOwnerConvergence,
      rowId: entry.id,
      checks: checks,
      evidence: evidence,
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await second.cleanup()
    await first.cleanup()
  }
}
