import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCalSync

@Suite
struct AckIntegrityTests {
  @Test
  func foreignAcknowledgementRejectsTheWholeBatch() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 2)
    await harness.transport.configure(
      pushResponse: PushResponse(
        accepted: [
          PushAcknowledgement(
            opId: UUID(),
            serverVersion: 1,
            acceptedOpId: UUID(),
            duplicate: false
          )
        ]
      )
    )

    await harness.engine.bind(UUID())
    await #expect(throws: (any Error).self) {
      try await harness.engine.dispatch()
    }

    let pending = try await pendingIds(harness)
    #expect(pending == Set(operations.map(\.opId)))
    #expect(await harness.transport.pullCalls.isEmpty)
  }

  @Test
  func duplicateAcknowledgementRejectsTheWholeBatch() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 1)
    let opId = try #require(operations.first?.opId)
    await harness.transport.configure(
      pushResponse: PushResponse(
        accepted: [
          PushAcknowledgement(
            opId: opId,
            serverVersion: 1,
            acceptedOpId: UUID(),
            duplicate: false
          ),
          PushAcknowledgement(
            opId: opId,
            serverVersion: 1,
            acceptedOpId: UUID(),
            duplicate: false
          ),
        ]
      )
    )

    await harness.engine.bind(UUID())
    await #expect(throws: (any Error).self) {
      try await harness.engine.dispatch()
    }

    #expect(try await pendingIds(harness) == [opId])
    #expect(await harness.transport.pullCalls.isEmpty)
  }

  @Test
  func partialAcknowledgementRejectsTheWholeBatch() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 2)
    let acknowledged = try #require(operations.first?.opId)
    await harness.transport.configure(
      pushResponse: PushResponse(
        accepted: [
          PushAcknowledgement(
            opId: acknowledged,
            serverVersion: 1,
            acceptedOpId: UUID(),
            duplicate: false
          )
        ]
      )
    )

    await harness.engine.bind(UUID())
    await #expect(throws: (any Error).self) {
      try await harness.engine.dispatch()
    }

    #expect(try await pendingIds(harness) == Set(operations.map(\.opId)))
    #expect(await harness.transport.pullCalls.isEmpty)
  }
}

private func pendingIds(_ harness: EngineHarness) async throws -> Set<UUID> {
  let operations = try await harness.database.read {
    try PendingOp.fetchAll($0)
  }
  return Set(operations.map(\.opId))
}
