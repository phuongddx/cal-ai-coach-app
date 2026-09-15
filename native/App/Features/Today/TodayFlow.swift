import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

struct TodayFlow: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: TodayModel?
  @State private var isOnboardingPresented = false

  var body: some View {
    NavigationStack {
      if let model {
        TodayView(
          model: model,
          isOffline: environment.isOffline,
          onStartSetup: { isOnboardingPresented = true }
        )
      } else {
        Color.ccBackground.overlay(ProgressView())
      }
    }
    .task {
      if model == nil {
        model = TodayModel(
          pool: environment.database,
          userId: environment.currentUserId,
          tracking: TrackingRepository(database: environment.database),
          now: environment.now,
          healthKitService: environment.healthKitService
        )
      }
    }
    .fullScreenCover(isPresented: $isOnboardingPresented) {
      OnboardingFlowRoute()
    }
    .onChange(of: environment.hasTargets) { _, hasTargets in
      if hasTargets {
        isOnboardingPresented = false
      }
    }
  }
}
