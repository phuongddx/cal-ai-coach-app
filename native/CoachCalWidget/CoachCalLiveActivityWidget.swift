import ActivityKit
import CoachCalDesignSystem
import SwiftUI
import WidgetKit

// ENG-04, Apple's fixed ActivityConfiguration/DynamicIsland presentation
// contract — never a custom overlay window. Reads only context.state, which
// ScanModel populates from AppEnvironment.edSafeMode at save-time (the same
// Pitfall 6 constraint as WidgetSnapshot: this process cannot reach the
// host's SwiftUI Environment).
struct CoachCalLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CoachCalLiveActivityAttributes.self) { context in
      LiveActivityBannerView(state: context.state)
        .activityBackgroundTint(Color.ccBackground)
        .activitySystemActionForegroundColor(Color.ccTextPrimary)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text("Calories left")
            .ccFont(.caption)
            .foregroundStyle(Color.ccTextSecondary)
        }
        DynamicIslandExpandedRegion(.trailing) {
          LiveActivityValueView(state: context.state)
        }
      } compactLeading: {
        Image(systemName: "fork.knife")
          .foregroundStyle(Color.ccAccentLime)
      } compactTrailing: {
        LiveActivityValueView(state: context.state)
      } minimal: {
        Image(systemName: "fork.knife")
          .foregroundStyle(Color.ccAccentLime)
      }
    }
  }
}

private struct LiveActivityValueView: View {
  let state: CoachCalLiveActivityAttributes.ContentState

  var body: some View {
    // Pitfall 6, re-implemented locally: never edSafeHidden() — this process
    // cannot reach the host app's @Environment(\.edSafeMode).
    if state.edSafeMode {
      Text("On track")
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextPrimary)
    } else {
      Text("\(state.caloriesRemaining)")
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextPrimary)
    }
  }
}

private struct LiveActivityBannerView: View {
  let state: CoachCalLiveActivityAttributes.ContentState

  var body: some View {
    HStack {
      Text("Calories left")
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextSecondary)
      Spacer()
      LiveActivityValueView(state: state)
    }
    .padding(CCSpace.md)
  }
}
