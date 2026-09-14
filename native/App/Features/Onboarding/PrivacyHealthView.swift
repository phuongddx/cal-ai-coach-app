import CoachCalDesignSystem
import SwiftUI

// HealthKit connect is a Phase-3 stub (INT-01 is Phase 4): the button only
// reveals a footnote — it can never raise a permission prompt or read data.
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
          showConnectNote = true
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
