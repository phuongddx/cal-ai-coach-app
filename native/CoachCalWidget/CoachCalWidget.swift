import SwiftUI
import WidgetKit

struct CoachCalCaloriesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: "CoachCalCaloriesWidget",
      provider: CaloriesRemainingTimelineProvider()
    ) { entry in
      CaloriesRemainingWidgetView(entry: entry)
    }
    .configurationDisplayName("Calories Remaining")
    .description("Shows how many calories you have left today.")
    .supportedFamilies([.systemSmall])
  }
}

@main
struct CoachCalWidgetBundle: WidgetBundle {
  var body: some Widget {
    CoachCalCaloriesWidget()
    CoachCalLiveActivityWidget()
  }
}
