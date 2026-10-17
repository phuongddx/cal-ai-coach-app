import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct GoalPickerView: View {
  let model: OnboardingModel

  private let options: [(goal: TargetsEngine.Goal, title: String, subtitle: String, icon: String)] = [
    (.lose, "Lose weight", "Sustainable calorie deficit", "flame"),
    (.maintain, "Maintain weight", "Stay at your current weight", "equal.circle"),
    (.gain, "Gain weight", "Healthy calorie surplus", "arrow.up.circle"),
    (.habit, "Build a habit", "Just track, no calorie goal", "checkmark.seal"),
  ]

  var body: some View {
    OnboardingStepScaffold(
      title: "What's your goal?",
      subtitle: "We'll personalize your plan",
      progress: model.progress,
      action: { model.advance() }
    ) {
      VStack(spacing: CCSpace.md) {
        ForEach(options, id: \.goal) { option in
          Button {
            model.selectGoal(option.goal)
          } label: {
            CCOptionCard(
              title: option.title,
              subtitle: option.subtitle,
              icon: option.icon,
              isSelected: model.draft.goal == option.goal
            )
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("onboarding.goalCard.\(option.goal.rawValue)")
        }
      }
    }
  }
}
