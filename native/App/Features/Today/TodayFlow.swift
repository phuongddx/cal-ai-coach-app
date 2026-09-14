import CoachCalDesignSystem
import SwiftUI

struct TodayFlow: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: TodayModel?

  var body: some View {
    NavigationStack {
      if let model {
        TodayView(model: model, isOffline: environment.isOffline)
      } else {
        Color.ccBackground.overlay(ProgressView())
      }
    }
    .task {
      if model == nil {
        model = TodayModel(
          pool: environment.database,
          userId: AppEnvironment.demoUserId,
          now: environment.now
        )
      }
    }
  }
}
