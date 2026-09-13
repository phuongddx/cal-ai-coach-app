import SwiftUI

struct WalkingScreen: View {
  @State private var model = WalkingModel()

  var body: some View {
    NavigationStack {
      VStack(spacing: 24) {
        Text("Walk")
          .font(.largeTitle.weight(.semibold))
          .accessibilityIdentifier("walking.title")

        Text("Count: \(model.count)")
          .font(.title2.monospacedDigit())
          .accessibilityIdentifier("walking.count")

        Button("Increment") {
          model.increment()
        }
        .buttonStyle(.borderedProminent)
        .accessibilityIdentifier("walking.increment")
      }
      .padding()
      .navigationTitle("CoachCal")
    }
  }
}
