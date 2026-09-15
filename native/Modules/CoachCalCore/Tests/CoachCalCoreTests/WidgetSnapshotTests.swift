import Foundation
import Testing

@testable import CoachCalCore

@Suite
struct WidgetSnapshotTests {
  @Test
  func encodeDecodeRoundTripPreservesAllFields() throws {
    let snapshot = WidgetSnapshot(
      caloriesRemaining: 420,
      edSafeMode: true,
      updatedAt: Date(timeIntervalSince1970: 1_700_000_000)
    )
    let data = try JSONEncoder().encode(snapshot)
    let decoded = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
    #expect(decoded == snapshot)
  }

  // `swift test` runs outside any app's provisioning profile, so the App
  // Group container is never available here — this exercises the exact
  // "nil container" path a malformed/unprovisioned host would hit
  // (T-P45-02: defensive parsing, never a crash).
  @Test
  func writeIsSilentNoOpWhenAppGroupContainerIsUnavailable() {
    let store = WidgetSnapshotStore()
    store.write(WidgetSnapshot(caloriesRemaining: 100, edSafeMode: false, updatedAt: Date()))
    #expect(store.read() == nil)
  }

  @Test
  func clearIsSilentNoOpWhenAppGroupContainerIsUnavailable() {
    // No crash is the assertion — nothing further to observe without a real container.
    WidgetSnapshotStore().clear()
  }

  @Test
  func readReturnsNilWhenNothingHasBeenWritten() {
    #expect(WidgetSnapshotStore().read() == nil)
  }
}
