import MetricKit
import Testing
@testable import CoachCal

@MainActor
@Suite
struct MetricKitIsolationTests {
  @Test func objCDispatchOffMainDeliversBothPayloadTypesWithoutIsolationTrap() async {
    let counter = CallbackCounter()
    let subscriber = MetricKitSubscriber(
      onMetricPayloads: { _ in counter.recordMetricPayload() },
      onDiagnosticPayloads: { _ in counter.recordDiagnosticPayload() }
    )
    let metricSelector = #selector(
      subscriber.didReceive(_:) as ([MXMetricPayload]) -> Void
    )
    let diagnosticSelector = #selector(
      subscriber.didReceive(_:) as ([MXDiagnosticPayload]) -> Void
    )

    await withCheckedContinuation { continuation in
      DispatchQueue(label: "coachcal.metrickit.test").async {
        subscriber.perform(metricSelector, with: NSArray())
        subscriber.perform(diagnosticSelector, with: NSArray())
        continuation.resume()
      }
    }

    let counts = counter.counts
    #expect(counts.metric == 1)
    #expect(counts.diagnostic == 1)
  }
}

private nonisolated final class CallbackCounter: @unchecked Sendable {
  private let lock = NSLock()
  private var metricPayloadCount = 0
  private var diagnosticPayloadCount = 0

  func recordMetricPayload() {
    lock.lock(); defer { lock.unlock() }
    metricPayloadCount += 1
  }

  func recordDiagnosticPayload() {
    lock.lock(); defer { lock.unlock() }
    diagnosticPayloadCount += 1
  }

  var counts: (metric: Int, diagnostic: Int) {
    lock.lock(); defer { lock.unlock() }
    return (metricPayloadCount, diagnosticPayloadCount)
  }
}
