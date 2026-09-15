import CoachCalDesignSystem
import SwiftUI

struct RootView: View {
  @Environment(AppEnvironment.self) private var environment

  var body: some View {
    if environment.isReady {
      if environment.requiresSignIn && environment.authSession == nil {
        SignInView()
      } else if environment.hasTargets || environment.onboardingPending {
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

// The 03-03 onboarding flow: quiz → targets → TargetRepository save → MainShell.
struct OnboardingFlowRoute: View {
  @Environment(AppEnvironment.self) private var environment

  var body: some View {
    OnboardingFlowView(
      model: OnboardingModel(
        userId: environment.currentUserId,
        now: environment.now,
        animationsDisabled: environment.animationsDisabled,
        save: { try await environment.targetRepository.saveTarget($0) },
        onComplete: { environment.completeOnboarding() },
        requestHealthAccess: { await environment.healthKitService.requestAuthorizationIfNeeded() }
      )
    )
  }
}
