import CoachCalDesignSystem
import SwiftUI

// INT-01 (Phase 4): the connect button makes a real JIT HealthKit permission
// request through OnboardingModel.requestHealthAccess(). Denial reveals the
// existing footnote below; a granted authorization advances past it silently.
struct PrivacyHealthView: View {
  let model: OnboardingModel

  @State private var showConnectNote = false

  var body: some View {
    OnboardingStepScaffold(
      title: "Privacy & Health",
      subtitle: "Your data, your choice",
      progress: model.progress,
      ctaTitle: "Skip for now",
      action: { model.advance() }
    ) {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        CCSettingsGroup {
          CCSettingsRow(
            icon: "heart",
            label: "Connect Apple Health",
            value: "Sync steps, workouts, and weight automatically"
          )
          CCSettingsRow(
            icon: "flame",
            label: "Activity calories",
            value: "Auto-adjust your daily target"
          )
          CCSettingsRow(
            icon: "scalemass",
            label: "Weight sync",
            value: "Track progress without logging"
          )
        }
        VStack(alignment: .leading, spacing: CCSpace.sm) {
          CCSectionHeader("Privacy promise")
          CCBannerNote(OnboardingCopy.privacyPromiseBanner, variant: .success)
            .accessibilityIdentifier("onboarding.privacyPromise")
        }
        CCSecondaryButton("Connect Apple Health", bordered: true) {
          Task {
            let granted = await model.requestHealthAccess()
            showConnectNote = !granted
          }
        }
        .accessibilityIdentifier("onboarding.healthConnect")
        if showConnectNote {
          Text(OnboardingCopy.healthConnectNote)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
            .accessibilityIdentifier("onboarding.healthConnectNote")
        }
      }
    }
  }
}
