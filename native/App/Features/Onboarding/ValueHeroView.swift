import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct ValueHeroView: View {
  let model: OnboardingModel

  var body: some View {
    OnboardingStepScaffold(
      title: "Track calories with a photo",
      subtitle: "The honest AI calorie coach",
      progress: model.progress,
      ctaTitle: "Get started",
      ctaIdentifier: "onboarding.getStarted",
      action: { model.advance() }
    ) {
      VStack(spacing: CCSpace.lg) {
        featureRow(icon: "eye", title: "AI estimates with confidence", detail: "See when AI is certain vs. guessing")
        featureRow(icon: "tag", title: "Transparent pricing always", detail: "No hidden fees. Cancel anytime.")
        featureRow(icon: "heart", title: OnboardingCopy.edSafeTitle, detail: OnboardingCopy.edSafeSubtitle)
      }
    }
  }

  private func featureRow(icon: String, title: String, detail: String) -> some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: CCRadius.md)
        .fill(Color.ccAccentLime.opacity(0.15))
        .frame(width: 48, height: 48)
        .overlay(
          Image(systemName: icon)
            .font(.system(size: 20))
            .foregroundStyle(Color.ccAccentInk)
        )
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Text(detail)
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(title), \(detail)")
  }
}
