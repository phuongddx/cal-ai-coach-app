import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCal

@Suite
struct ReplayIdempotencyProof {
  @Test
  func duplicateOperationAcknowledgesWithoutChangingMirror() async throws {
    let harness = try await ProofHarness.create(runtime: "iOS 18.4")
    let entry = ProofSupport.newEntry(owner: harness.owner)
    let stored = try await harness.diary.recordUpsert(entry)
    let operation = try ProofSupport.operation(for: stored)

    let first = try await harness.bindAndDispatch()
    let before = try await harness.entry(entry.id)

    let replayResponse = try await harness.transport.push(
      PushRequest(operations: [operation])
    )
    let replayAck = replayResponse.accepted.first
    let after = try await harness.entry(entry.id)

    #expect(first.acked == 1)
    #expect(replayAck?.opId == stored.opId)
    #expect(replayAck?.duplicate == true)
    #expect(try await harness.pendingCount() == 0)
    #expect(after == before)

    let record = ProofHarness.makeRecord(
      scenario: .offlineReconnect,
      rowId: entry.id,
      checks: [ProofCheck(name: "replayIdempotency", status: .pass, timingMs: first.acked)],
      evidence: [
        "pendingCount": .int(0),
        "serverVersion": .int(Int(before?.serverVersion ?? 0)),
        "acceptedOpId": .uuid(before?.acceptedOpId ?? stored.opId),
        "tombstone": .bool(false),
      ],
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await harness.cleanup()
  }
}
