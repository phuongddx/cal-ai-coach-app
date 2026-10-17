import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCal

@Suite
struct OnlineLatencyProof {
  @Test
  func dispatchPushAndPullCompletesWithinRoadmapBound() async throws {
    let harness = try await ProofHarness.create(runtime: "iOS 18.4")
    let entry = ProofSupport.newEntry(owner: harness.owner)
    _ = try await harness.diary.recordUpsert(entry)

    let result = try await harness.bindAndDispatch()
    guard let call = harness.transport.successfulCall() else {
      Issue.record("transport did not capture the dispatch")
      return
    }
    let pull = try #require(call.pull)

    let durationMs = pull.endedAt.epochMilliseconds - call.push.startedAt.epochMilliseconds
    #expect(result.acked == 1)
    // A fresh account's own op comes back on the same dispatch's pull
    // (loopback), so exactly one op is pulled and the cursor advances.
    #expect(result.pulled == 1)
    #expect(try await harness.pendingCount() == 0)
    #expect(durationMs > 0 && durationMs <= 2_000)

    let record = ProofHarness.makeRecord(
      scenario: .online,
      rowId: entry.id,
      checks: [
        ProofCheck(
          name: "dispatch",
          status: .pass,
          timingMs: durationMs,
          dispatchId: call.dispatchId
        )
      ],
      evidence: [
        "submittedAtMs": .int(call.push.startedAt.epochMilliseconds),
        "acknowledgedAtMs": .int(pull.endedAt.epochMilliseconds),
        "serverVersion": .int(Int(entry.serverVersion) + result.acked),
      ],
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await harness.cleanup()
  }
}
