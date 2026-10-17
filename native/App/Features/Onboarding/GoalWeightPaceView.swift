import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct GoalWeightPaceView: View {
  let model: OnboardingModel

  @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 56

  private var showsPace: Bool {
    switch model.draft.goal {
    case .lose, .gain: true
    case .maintain, .habit: false
    }
  }

  private var goalWeightKg: Int {
    Int(model.draft.goalWeightKg ?? model.draft.weightKg)
  }

  private var goalWeightBinding: Binding<Int> {
    Binding(
      get: { goalWeightKg },
      set: { model.draft.goalWeightKg = Double($0) }
    )
  }

  private var paceBinding: Binding<Double> {
    Binding(
      get: { model.draft.requestedPaceKgPerWeek ?? 0.5 },
      set: { model.setPace($0) }
    )
  }

  private var paceText: String {
    String(format: "%.2f", model.draft.requestedPaceKgPerWeek ?? 0.5)
  }

  var body: some View {
    OnboardingStepScaffold(
      title: "Your target",
      subtitle: "We recommend gradual, sustainable progress",
      progress: model.progress,
      action: { model.advance() }
    ) {
      VStack(alignment: .leading, spacing: CCSpace.xl) {
        VStack(spacing: CCSpace.xs) {
          Text("Goal weight")
            .ccFont(.headline)
            .foregroundStyle(Color.ccTextPrimary)
          HStack(alignment: .firstTextBaseline, spacing: CCSpace.xs) {
            Text("\(goalWeightKg)")
              .font(.system(size: heroSize, weight: .bold))
              .monospacedDigit()
              .foregroundStyle(Color.ccAccentInk)
            Text("kg")
              .ccFont(.subhead)
              .foregroundStyle(Color.ccTextSecondary)
          }
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("Goal weight \(goalWeightKg) kilograms")
          .accessibilityIdentifier("onboarding.goalWeightHero")
        }
        CCWheelField(
          label: "Goal weight",
          items: Array(40...150),
          selection: goalWeightBinding,
          displayText: { "\($0) kg" }
        )
        .accessibilityIdentifier("onboarding.goalWeightField")
        if showsPace {
          paceSection
        }
      }
    }
  }

  private var paceSection: some View {
    VStack(alignment: .leading, spacing: CCSpace.sm) {
      HStack {
        Text("Weekly pace")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Text("\(paceText) kg/wk")
          .ccFont(.headline)
          .monospacedDigit()
          .foregroundStyle(Color.ccAccentInk)
          .accessibilityIdentifier("onboarding.paceValue")
      }
      Slider(value: paceBinding, in: 0...1.5, step: 0.05)
        .accessibilityIdentifier("onboarding.paceSlider")
        .accessibilityValue("\(paceText) kilograms per week")
      HStack {
        Text("Slow")
        Spacer()
        Text("Recommended")
        Spacer()
        Text("Fast")
      }
      .ccFont(.caption)
      .foregroundStyle(Color.ccTextSecondary)
      .accessibilityHidden(true)
      if model.paceClamped {
        CCBannerNote(markdown: OnboardingCopy.safetyFloorBanner, variant: .success)
          .accessibilityIdentifier("onboarding.safetyFloor")
      }
    }
  }
}
