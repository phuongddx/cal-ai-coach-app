import CoachCalCore
import CoachCalDesignSystem
import SwiftUI
import WidgetKit

// TimelineProvider reads ONLY WidgetSnapshotStore's file — zero network,
// zero SwiftUI Environment access (Pattern 7/Pitfall 6, 04-RESEARCH.md).
// `.never` refresh policy: freshness comes exclusively from the host app's
// own `WidgetCenter.shared.reloadTimelines(ofKind:)` calls on foregrounded
// writes/foreground (Pitfall 5) — never a background-scheduled cadence.
struct CaloriesRemainingEntry: TimelineEntry {
  let date: Date
  let caloriesRemaining: Int
  let edSafeMode: Bool
}

struct CaloriesRemainingTimelineProvider: TimelineProvider {
  private let store = WidgetSnapshotStore()

  func placeholder(in context: Context) -> CaloriesRemainingEntry {
    CaloriesRemainingEntry(date: Date(), caloriesRemaining: 0, edSafeMode: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (CaloriesRemainingEntry) -> Void) {
    completion(entry(from: store.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CaloriesRemainingEntry>) -> Void) {
    completion(Timeline(entries: [entry(from: store.read())], policy: .never))
  }

  private func entry(from snapshot: WidgetSnapshot?) -> CaloriesRemainingEntry {
    guard let snapshot else {
      return CaloriesRemainingEntry(date: Date(), caloriesRemaining: 0, edSafeMode: false)
    }
    return CaloriesRemainingEntry(
      date: snapshot.updatedAt,
      caloriesRemaining: snapshot.caloriesRemaining,
      edSafeMode: snapshot.edSafeMode
    )
  }
}

struct CaloriesRemainingWidgetView: View {
  let entry: CaloriesRemainingEntry

  var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      Text("Calories left")
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
      // Pitfall 6: re-implemented locally, not edSafeHidden() — a widget
      // process cannot reach the host app's @Environment(\.edSafeMode).
      if entry.edSafeMode {
        Text("On track this week")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityLabel("On track this week")
      } else {
        Text("\(entry.caloriesRemaining)")
          .ccFont(.title)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityLabel("\(entry.caloriesRemaining) calories left")
      }
    }
    .padding(CCSpace.md)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(Color.ccBackground, for: .widget)
  }
}
