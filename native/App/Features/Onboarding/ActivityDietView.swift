import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct ActivityDietView: View {
  let model: OnboardingModel

  private let levels: [(level: TargetsEngine.ActivityLevel, title: String, subtitle: String, icon: String)] = [
    (.sedentary, "Sedentary", "Mostly sitting, little movement", "figure.seated.side"),
    (.light, "Lightly active", "Light exercise 1–3 days a week", "figure.walk"),
    (.moderate, "Moderately active", "Exercise 3–5 days a week", "figure.run"),
    (.active, "Very active", "Hard exercise 6–7 days a week", "dumbbell"),
    (.athlete, "Athlete", "Training most days, high intensity", "trophy.fill"),
  ]

  private let dietStyles = ["Standard", "High protein", "Vegetarian", "Vegan", "Keto"]

  var body: some View {
    OnboardingStepScaffold(
      title: "Lifestyle",
      subtitle: "Fine-tune your calorie target",
      progress: model.progress,
      action: { model.advance() }
    ) {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        Text("Activity level")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("onboarding.activityHeader")
        ForEach(levels, id: \.level) { entry in
          Button {
            model.draft.activityLevel = entry.level
          } label: {
            CCOptionCard(
              title: entry.title,
              subtitle: entry.subtitle,
              icon: entry.icon,
              isSelected: model.draft.activityLevel == entry.level
            )
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("onboarding.activityCard.\(entry.level.rawValue)")
        }
        Text("Diet style (optional)")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("onboarding.dietHeader")
        VStack(spacing: CCSpace.sm) {
          HStack(spacing: CCSpace.sm) {
            dietChip("Standard")
            dietChip("High protein")
            dietChip("Vegetarian")
          }
          HStack(spacing: CCSpace.sm) {
            dietChip("Vegan")
            dietChip("Keto")
            Spacer()
          }
        }
      }
    }
  }

  private func dietChip(_ style: String) -> some View {
    Button {
      model.selectDietStyle(style)
    } label: {
      CCChipOption(title: style, isSelected: model.dietStyle == style)
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("onboarding.dietChip.\(style.lowercased().replacingOccurrences(of: " ", with: ""))")
  }
}
