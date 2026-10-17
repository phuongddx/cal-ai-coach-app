import Foundation
import Testing

import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence

@testable import CoachCal

@Suite
struct CrossUserDenialProof {
  @Test
  func foreignRecordPushIsRejectedWithoutApplyingState() async throws {
    let ownerHarness = try await ProofHarness.create(runtime: "iOS 18.4")
    let entry = ProofSupport.newEntry(owner: ownerHarness.owner)
    let stored = try await ownerHarness.diary.recordUpsert(entry)
    _ = try await ownerHarness.bindAndDispatch()

    let attacker = try await ProofHarness.create(runtime: "iOS 18.4")
    let forged = ProofSupport.newEntry(owner: attacker.owner, id: entry.id)
    _ = try await attacker.diary.recordUpsert(forged)

    var typedError: SyncTransportError?
    do {
      _ = try await attacker.bindAndDispatch()
      Issue.record("cross-user push unexpectedly succeeded")
    } catch let error as SyncTransportError {
      typedError = error
    }

    if case .rpc(let code, _) = typedError {
      #expect(code == "42501")
    } else {
      Issue.record("expected typed RPC ownership denial")
    }
    #expect(try await attacker.pendingCount() == 1)
    #expect(try await attacker.entry(entry.id)?.acceptedOpId == nil)
    #expect(try await ownerHarness.entry(entry.id)?.acceptedOpId == stored.opId)

    let record = ProofHarness.makeRecord(
      scenario: .crossUserDenial,
      checks: [ProofCheck(name: "ownershipDenial", status: .pass, timingMs: 0)],
      evidence: [
        "pendingCount": .int(1),
        "errorCode": .string("42501"),
        "tombstone": .bool(false),
      ],
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await attacker.cleanup()
    await ownerHarness.cleanup()
  }
}
