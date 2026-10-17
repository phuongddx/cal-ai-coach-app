import MetricKit
import Testing
@testable import CoachCal

@MainActor
@Suite
struct MetricKitIsolationTests {
  @Test func metricCallbacksRunOffTheMainActor() async {
    await confirmation("metric payloads") { metricPayloads in
      let subscriber = MetricKitSubscriber(
        onMetricPayloads: { _ in metricPayloads() },
        onDiagnosticPayloads: { _ in
          Issue.record("Metric payloads must not invoke the diagnostic callback")
        }
      )

      DispatchQueue(label: "coachcal.metrickit.test").async {
        let selector = #selector(
          subscriber.didReceive(_:) as ([MXMetricPayload]) -> Void
        )
        subscriber.perform(selector, with: NSArray())
      }
    }
  }

  @Test func diagnosticCallbacksRunOffTheMainActor() async {
    await confirmation("diagnostic payloads") { diagnosticPayloads in
      let subscriber = MetricKitSubscriber(
        onMetricPayloads: { _ in
          Issue.record("Diagnostic payloads must not invoke the metric callback")
        },
        onDiagnosticPayloads: { _ in diagnosticPayloads() }
      )

      DispatchQueue(label: "coachcal.metrickit.test").async {
        let selector = #selector(
          subscriber.didReceive(_:) as ([MXDiagnosticPayload]) -> Void
        )
        subscriber.perform(selector, with: NSArray())
      }
    }
  }
}
