import Foundation
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCalSync

@Suite
struct TriggerTests {
  @Test
  func foregroundNetworkAndBGTaskSeamsInvokeEngineDispatch() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 3)
    await harness.transport.configure(pushResponse: validAckResponse(for: operations))
    await harness.engine.bind(UUID())

    let engine = harness.engine
    let fireEngine: SyncFireAction = {
      Task {
        _ = try? await engine.dispatch()
      }
    }
    let triggers: [any SyncTriggering] = [
      ForegroundTrigger(fire: fireEngine),
      NWPathTrigger(fire: fireEngine),
      BGTaskTrigger(fire: fireEngine),
    ]

    for trigger in triggers {
      trigger.fire()
    }
    try await Task.sleep(for: .milliseconds(50))

    #expect(await harness.transport.pushCalls.count == 1)
  }
}
