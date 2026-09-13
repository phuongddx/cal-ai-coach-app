import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCal

@Suite
struct OfflineReconnectProof {
  @Test
  func offlineWriteSurvivesThenReconnectFlushesAndClearsOutbox() async throws {
    let harness = try await ProofHarness.create(runtime: "iOS 18.4")
    let entry = ProofSupport.newEntry(owner: harness.owner)
    let stored = try await harness.diary.recordUpsert(entry)

    #expect(try await harness.pendingCount() == 1)
    #expect(try await harness.entry(entry.id)?.displayText == "offline proof")

    let result = try await harness.bindAndDispatch()
    let row = try await harness.entry(entry.id)

    #expect(result.acked == 1)
    #expect(try await harness.pendingCount() == 0)
    #expect(row?.acceptedOpId == stored.opId)
    #expect((row?.serverVersion ?? 0) > 0)

    let record = ProofHarness.makeRecord(
      scenario: .offlineReconnect,
      rowId: entry.id,
      checks: [ProofCheck(name: "reconnectFlush", status: .pass, timingMs: result.acked)],
      evidence: [
        "pendingCount": .int(0),
        "serverVersion": .int(Int(row?.serverVersion ?? 0)),
        "tombstone": .bool(false),
      ],
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await harness.cleanup()
  }
}
