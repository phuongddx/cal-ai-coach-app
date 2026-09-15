import HealthKit
import XCTest

@testable import CoachCal

// Mirrors ScanCapturePermissionTests' shape (mock conformer + notDetermined/authorized/denied
// cases), swapping AVCaptureDevice for a mock HKHealthStore-abstracting protocol conformer. The
// real HKHealthStore can't be driven deterministically in a unit test and has no data on the
// Simulator — this suite proves the LOGIC seam only. Background-delivery timing and the real
// on-device authorization-prompt UX are unverifiable here (RESEARCH Pitfall 12); that proof
// routes to 04-07's physical-device checkpoint, per this plan's own backstop truth.
nonisolated final class HealthKitServiceTests: XCTestCase {
  @MainActor
  final class MockHealthStore: HealthStoring {
    var status: HKAuthorizationStatus = .notDetermined
    var requestCallCount = 0
    var backgroundDeliveryCallCount = 0
    var savedObjects: [HKObject] = []

    func authorizationStatus(for type: HKObjectType) -> HKAuthorizationStatus { status }

    func requestAuthorization(
      toShare typesToShare: Set<HKSampleType>, read typesToRead: Set<HKObjectType>
    ) async throws {
      requestCallCount += 1
      status = .sharingAuthorized
    }

    func enableBackgroundDelivery(for type: HKObjectType, frequency: HKUpdateFrequency) async throws {
      backgroundDeliveryCallCount += 1
    }

    func execute(_ query: HKQuery) {}

    func save(_ object: HKObject) async throws {
      savedObjects.append(object)
    }
  }

  @MainActor
  func testNotDeterminedRequestsExactlyOnce() async {
    let store = MockHealthStore()
    store.status = .notDetermined
    let service = HKHealthKitService(store: store)

    let granted = await service.requestAuthorizationIfNeeded()

    XCTAssertTrue(granted)
    XCTAssertEqual(store.requestCallCount, 1)
  }

  @MainActor
  func testAuthorizedNeverRequestsAgain() async {
    let store = MockHealthStore()
    store.status = .sharingAuthorized
    let service = HKHealthKitService(store: store)

    let granted = await service.requestAuthorizationIfNeeded()

    XCTAssertTrue(granted)
    XCTAssertEqual(store.requestCallCount, 0, "already-authorized must never re-prompt")
  }

  @MainActor
  func testDeniedReturnsFalseWithoutThrowing() async {
    let store = MockHealthStore()
    store.status = .sharingDenied
    let service = HKHealthKitService(store: store)

    let granted = await service.requestAuthorizationIfNeeded()

    XCTAssertFalse(granted)
    XCTAssertEqual(store.requestCallCount, 0, "a terminal denial is a JIT no-op, not a re-ask")
  }

  @MainActor
  func testEnableBackgroundDeliveryOnlyRunsWhenAuthorized() async {
    let store = MockHealthStore()
    store.status = .notDetermined
    let service = HKHealthKitService(store: store)

    await service.enableBackgroundDeliveryIfAuthorized()
    XCTAssertEqual(store.backgroundDeliveryCallCount, 0)

    store.status = .sharingAuthorized
    await service.enableBackgroundDeliveryIfAuthorized()
    XCTAssertEqual(store.backgroundDeliveryCallCount, 1)
  }

  // Pure aggregation against stub HKQuantitySample instances — constructing a sample is a plain
  // object init, no store, no query execution, no Simulator/hardware dependency.
  func testStepAggregationSumsStubbedQuantitySamples() {
    let type = HKQuantityType(.stepCount)
    let now = Date()
    let samples = [
      HKQuantitySample(type: type, quantity: HKQuantity(unit: .count(), doubleValue: 500), start: now, end: now),
      HKQuantitySample(type: type, quantity: HKQuantity(unit: .count(), doubleValue: 250), start: now, end: now),
    ]

    XCTAssertEqual(HKHealthKitService.aggregateStepCount(from: samples), 750)
  }

  func testStepAggregationOfEmptySamplesIsZero() {
    XCTAssertEqual(HKHealthKitService.aggregateStepCount(from: []), 0)
  }

  // T-P43-01: the write seam only compiles/succeeds with a ConfirmedEnergyEntry. There is no
  // initializer path from ScanResponse/ScanItem into this type (proven structurally by the
  // plan's own `git grep -c "ConfirmedEnergyEntry|writeBurnedEnergy" -- Features/Scan` returning
  // 0), so this test proves the write actually reaches the mock store once a confirmed value
  // exists.
  @MainActor
  func testWriteBurnedEnergyOnlyAcceptsConfirmedEnergyEntry() async throws {
    let store = MockHealthStore()
    let service = HKHealthKitService(store: store)
    let entry = ConfirmedEnergyEntry(kcal: 320, confirmedAt: Date())

    try await service.writeBurnedEnergy(entry)

    XCTAssertEqual(store.savedObjects.count, 1)
  }

  @MainActor
  func testBurnAddBackEnabledDefaultsFalse() async {
    UserDefaults.standard.removeObject(forKey: HealthKitSettingsKey.burnAddBackEnabled)
    defer { UserDefaults.standard.removeObject(forKey: HealthKitSettingsKey.burnAddBackEnabled) }

    // Bind to a local (not an XCTAssert autoclosure temporary): an inline temporary's deinit
    // rides swift_task_deinitOnExecutorMainActorBackDeploy, which aborts on this sim runtime.
    let service = HKHealthKitService(store: MockHealthStore())
    XCTAssertFalse(service.burnAddBackEnabled)
  }

  // Backstop (RESEARCH Pitfall 12, this plan's must_haves backstop truth): background delivery's
  // actual on-device cadence and the real system permission-prompt UX cannot be exercised here —
  // there is nothing to assert against on the Simulator. That hardware proof is 04-07's physical-
  // device checkpoint; this suite's job stops at proving the logic seam above (request-once,
  // no-reask-once-resolved, denial-is-terminal, aggregation, write-type-gate).
}
