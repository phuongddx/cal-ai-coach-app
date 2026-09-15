import HealthKit

// Abstracts the exact HKHealthStore surface HealthKitService touches, so unit tests can inject a
// deterministic mock instead of driving the real system store: the real HKHealthStore can't be
// driven deterministically in a unit test, and background-delivery timing plus the real
// authorization-prompt UX are unverifiable on the Simulator entirely (RESEARCH Pitfall 12 — the
// physical-device proof routes to 04-07's checkpoint). This seam is what makes the LOGIC
// testable here.
protocol HealthStoring: AnyObject {
  func authorizationStatus(for type: HKObjectType) -> HKAuthorizationStatus
  func requestAuthorization(toShare typesToShare: Set<HKSampleType>, read typesToRead: Set<HKObjectType>) async throws
  func enableBackgroundDelivery(for type: HKObjectType, frequency: HKUpdateFrequency) async throws
  func execute(_ query: HKQuery)
  func save(_ object: HKObject) async throws
}

extension HKHealthStore: HealthStoring {}

@MainActor
protocol HealthKitService: AnyObject {
  /// JIT permission ask — only requests when `.notDetermined`, never throws, returns false on
  /// denial (same contract shape as `CameraCaptureService.requestAccessIfNeeded()`). Callers
  /// trigger this the first time a Health-backed surface (e.g. the Today Steps card) appears —
  /// never at app launch.
  func requestAuthorizationIfNeeded() async -> Bool
  /// Registers background delivery within the platform's hourly cap for stepCount (Pitfall 3/4);
  /// no-op unless already authorized.
  func enableBackgroundDeliveryIfAuthorized() async
  /// Today's aggregated step count via a one-shot anchored object query over midnight-to-now; 0
  /// while unauthorized.
  func todayStepCount() async throws -> Int
}

@MainActor
final class HKHealthKitService: HealthKitService {
  private let store: HealthStoring
  private let now: @Sendable () -> Date
  private let stepType = HKQuantityType(.stepCount)
  private var anchor: HKQueryAnchor?

  init(store: HealthStoring = HKHealthStore(), now: @escaping @Sendable () -> Date = { Date() }) {
    self.store = store
    self.now = now
  }

  func requestAuthorizationIfNeeded() async -> Bool {
    switch store.authorizationStatus(for: stepType) {
    case .sharingAuthorized:
      return true
    case .notDetermined:
      do {
        try await store.requestAuthorization(toShare: [], read: [stepType])
      } catch {
        return false
      }
      return store.authorizationStatus(for: stepType) == .sharingAuthorized
    default:
      return false
    }
  }

  func enableBackgroundDeliveryIfAuthorized() async {
    guard store.authorizationStatus(for: stepType) == .sharingAuthorized else { return }
    // stepCount's background-delivery frequency is hourly-capped by the platform no matter what's
    // requested here (Pitfall 3); foreground reads via todayStepCount() are NOT capped.
    try? await store.enableBackgroundDelivery(for: stepType, frequency: .hourly)
  }

  func todayStepCount() async throws -> Int {
    guard store.authorizationStatus(for: stepType) == .sharingAuthorized else { return 0 }
    let start = Calendar.current.startOfDay(for: now())
    let predicate = HKQuery.predicateForSamples(withStart: start, end: now(), options: .strictStartDate)
    let anchorSnapshot = anchor
    let (count, newAnchor): (Int, HKQueryAnchor?) = try await withCheckedThrowingContinuation { continuation in
      let query = HKAnchoredObjectQuery(
        type: stepType, predicate: predicate, anchor: anchorSnapshot, limit: HKObjectQueryNoLimit
      ) { _, samples, _, newAnchor, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        let quantitySamples = (samples as? [HKQuantitySample]) ?? []
        continuation.resume(returning: (Self.aggregateStepCount(from: quantitySamples), newAnchor))
      }
      store.execute(query)
    }
    anchor = newAnchor
    return count
  }

  // Pure aggregation, unit-tested directly against stub HKQuantitySample instances — no store, no
  // query execution, no Simulator/hardware dependency. `nonisolated` so it's callable from the
  // anchored query's off-actor results handler above.
  nonisolated static func aggregateStepCount(from samples: [HKQuantitySample]) -> Int {
    Int(samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: .count()) })
  }
}

// Test/preview-safe default: never touches HKHealthStore, always reports denied/empty. This is
// TodayModel's default `healthKitService` so hosted unit/snapshot tests that don't wire a real
// service through TodayFlow stay deterministic and never make a live HealthKit call (mirrors
// FixtureCaptureService's role for CameraCaptureService).
@MainActor
final class NoOpHealthKitService: HealthKitService {
  func requestAuthorizationIfNeeded() async -> Bool { false }
  func enableBackgroundDeliveryIfAuthorized() async {}
  func todayStepCount() async throws -> Int { 0 }
}
