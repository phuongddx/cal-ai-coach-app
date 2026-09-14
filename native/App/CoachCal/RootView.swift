import CoachCalDesignSystem
import SwiftUI

struct RootView: View {
  @Environment(AppEnvironment.self) private var environment

  var body: some View {
    if environment.isReady {
      if environment.hasTargets || environment.onboardingPending {
        MainShell()
      } else {
        OnboardingFlowRoute()
      }
    } else {
      ZStack {
        Color.ccBackground.ignoresSafeArea()
        ProgressView()
      }
    }
  }
}

// Minimal route placeholder — 03-03 replaces the contents with the real onboarding flow.
struct OnboardingFlowRoute: View {
  var body: some View {
    NavigationStack {
      VStack(spacing: CCSpace.md) {
        Text("Set up your plan")
          .ccFont(.title)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("onboarding.title")
        Text("Answer a few questions and we'll calculate your daily calorie and macro targets.")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
          .multilineTextAlignment(.center)
      }
      .padding(CCSpace.xl3)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color.ccBackground)
    }
  }
}
