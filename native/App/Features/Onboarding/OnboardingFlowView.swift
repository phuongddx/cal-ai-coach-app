import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct OnboardingFlowView: View {
  @State private var model: OnboardingModel

  init(model: OnboardingModel) {
    _model = State(initialValue: model)
  }

  var body: some View {
    NavigationStack(path: $model.path) {
      ValueHeroView(model: model)
        .navigationDestination(for: OnboardingStep.self) { step in
          destination(for: step)
        }
    }
  }

  @ViewBuilder
  private func destination(for step: OnboardingStep) -> some View {
    switch step {
    case .valueHero: ValueHeroView(model: model)
    case .goal: GoalPickerView(model: model)
    case .bodyMetrics: BodyMetricsView(model: model)
    case .goalWeightPace: GoalWeightPaceView(model: model)
    case .activityDiet: ActivityDietView(model: model)
    case .projection: ProjectionView(model: model)
    case .privacyHealth: PrivacyHealthView(model: model)
    case .generating: GeneratingPlanView(model: model)
    case .planReveal: PlanRevealView(model: model)
    }
  }
}

// Shared Group A layout: progress rail under the status bar, title (28 semibold)
// + subhead (15), content, pinned bottom CCPrimaryButton (16pt side / 32pt bottom).
struct OnboardingStepScaffold<Content: View>: View {
  let title: String
  var subtitle: String?
  let progress: Double
  var ctaTitle: String = "Continue"
  var ctaIdentifier: String = "onboarding.continue"
  var ctaEnabled: Bool = true
  let action: () -> Void
  @ViewBuilder var content: Content

  var body: some View {
    VStack(spacing: 0) {
      CCProgressRail(progress: progress)
        .padding(.horizontal, CCSpace.lg)
        .padding(.top, CCSpace.xs)
      ScrollView {
        VStack(alignment: .leading, spacing: CCSpace.xl) {
          Text(title)
            .ccFont(.title)
            .foregroundStyle(Color.ccTextPrimary)
            .accessibilityIdentifier("onboarding.title.\(title)")
          if let subtitle {
            Text(subtitle)
              .ccFont(.subhead)
              .foregroundStyle(Color.ccTextSecondary)
          }
          content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, CCSpace.lg)
        .padding(.top, CCSpace.xl3)
        .padding(.bottom, CCSpace.lg)
      }
      VStack(spacing: CCSpace.sm) {
        CCPrimaryButton(ctaTitle, action: action)
          .accessibilityIdentifier(ctaIdentifier)
          .disabled(!ctaEnabled)
      }
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.ccBackground.ignoresSafeArea())
  }
}
