import ActivityKit

// ENG-04, 04-RESEARCH.md Pattern 9: bounded, app-driven Live Activity around
// a single scan-save event — app-driven Activity.update()/end() only, no
// push/APNs anywhere. This exact file is compiled into BOTH the CoachCal app
// target (to call Activity.request/update/end from ScanModel) and the
// CoachCalWidget extension target (to declare the ActivityConfiguration UI) —
struct CoachCalLiveActivityAttributes: ActivityAttributes, Sendable {
  struct ContentState: Codable, Hashable, Sendable {
    var caloriesRemaining: Int
    var edSafeMode: Bool
  }

  var mealSlot: String
}
