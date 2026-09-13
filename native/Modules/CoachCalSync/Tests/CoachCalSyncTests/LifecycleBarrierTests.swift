import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCalSync

@Suite
struct LifecycleBarrierTests {
  @Test
  func stopDrainsInFlightDispatchBeforeANewOwnerCanBind() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 1)
    let gate = AsyncStream<Void>.makeStream(of: Void.self, bufferingPolicy: .bufferingNewest(1))
    await harness.transport.configure(
      pushResponse: validAckResponse(for: operations),
      pushWait: { await gate.stream.first { _ in true } }
    )
    let oldOwner = UUID()
    let newOwner = UUID()
    await harness.engine.bind(oldOwner)

    let dispatchTask = Task { try await harness.engine.dispatch() }
    while await harness.transport.pushCalls.isEmpty {
      try await Task.sleep(for: .milliseconds(5))
    }
    async let stopTask = harness.engine.stop()
    async let bindTask = harness.engine.bind(newOwner)

    try await Task.sleep(for: .milliseconds(50))
    #expect(await harness.transport.pushCalls.count == 1)
    let ownerBeforeRelease = await harness.engine.currentOwner()
    #expect(ownerBeforeRelease != newOwner)
    #expect(ownerBeforeRelease == nil)

    gate.continuation.yield()
    gate.continuation.finish()

    _ = try await dispatchTask.value
    await stopTask
    await bindTask

    #expect(await harness.engine.currentOwner() == newOwner)
    #expect(await harness.transport.pushCalls.count == 1)
  }

  @Test
  func mutationBurstCoalescesIntoOneTrailingDispatch() async throws {
    let harness = try makeHarness(debounceInterval: .milliseconds(20))
    let operations = try await harness.seedOutbox(count: 1)
    await harness.transport.configure(pushResponse: validAckResponse(for: operations))
    await harness.engine.bind(UUID())

    for _ in 0..<5 {
      await harness.engine.notifyLocalMutation()
    }
    try await Task.sleep(for: .milliseconds(120))

    #expect(await harness.transport.pushCalls.count == 1)
    #expect(try await harness.readPending(opId: operations[0].opId) == nil)
  }
}
