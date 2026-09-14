import CoachCalDesignSystem
import SwiftUI

// 120pt indeterminate→% ring + 4-step checklist; --ccDisableAnimations flips the
// steps instantly (the model skips the minimum window entirely).
struct GeneratingPlanView: View {
  let model: OnboardingModel

  var body: some View {
    VStack(spacing: 0) {
      CCProgressRail(progress: model.progress)
        .padding(.horizontal, CCSpace.lg)
        .padding(.top, CCSpace.xs)
      VStack(spacing: CCSpace.xl) {
        ring
        VStack(spacing: CCSpace.xs) {
          Text("Creating your plan")
            .ccFont(.title)
            .foregroundStyle(Color.ccTextPrimary)
          Text("Personalizing based on your goals")
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextSecondary)
        }
        VStack(alignment: .leading, spacing: CCSpace.md) {
          ForEach(OnboardingCopy.generationSteps.indices, id: \.self) { index in
            stepRow(index)
          }
        }
        .padding(CCSpace.lg)
        .background(Color.ccCard)
        .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
        .overlay(
          RoundedRectangle(cornerRadius: CCRadius.lg)
            .strokeBorder(Color.ccBorder, lineWidth: 1)
        )
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.xl4)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.ccBackground.ignoresSafeArea())
    .accessibilityIdentifier("onboarding.generating")
    .task { model.beginGeneration() }
  }

  @ViewBuilder
  private var ring: some View {
    let size = CCSize.ringCompact
    let stroke = CCSize.ringCompactStroke
    ZStack {
      Circle()
        .stroke(Color.ccSurface, lineWidth: stroke)
      if let percent = model.generationPercent {
        Circle()
          .trim(from: 0, to: min(max(Double(percent) / 100, 0), 1))
          .stroke(
            Color.ccAccentLime,
            style: StrokeStyle(lineWidth: stroke, lineCap: .round)
          )
          .rotationEffect(.degrees(-90))
      } else {
        Circle()
          .trim(from: 0, to: 0.25)
          .stroke(
            Color.ccAccentLime,
            style: StrokeStyle(lineWidth: stroke, lineCap: .round)
          )
          .rotationEffect(.degrees(-90))
          .accessibilityHidden(true)
      }
      Text(percentText)
        .font(.system(size: 28, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccAccentInk)
        .accessibilityIdentifier("onboarding.generatingPercent")
    }
    .frame(width: size, height: size)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Generating your plan, \(percentText)")
  }

  private var percentText: String {
    if let percent = model.generationPercent {
      return "\(percent)%"
    }
    return "…"
  }

  @ViewBuilder
  private func stepRow(_ index: Int) -> some View {
    HStack(spacing: CCSpace.md) {
      stepIcon(model.generationStates[index])
      Text(OnboardingCopy.generationSteps[index])
        .ccFont(.subhead)
        .fontWeight(model.generationStates[index] == .idle ? .regular : .medium)
        .foregroundStyle(
          model.generationStates[index] == .idle ? Color.ccTextSecondary : Color.ccTextPrimary
        )
      Spacer(minLength: 0)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "\(OnboardingCopy.generationSteps[index]), \(stateLabel(model.generationStates[index]))"
    )
    .accessibilityIdentifier("onboarding.genStep.\(index)")
  }

  @ViewBuilder
  private func stepIcon(_ state: OnboardingModel.GenerationStepState) -> some View {
    switch state {
    case .done:
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 18))
        .foregroundStyle(Color.ccSuccessInk)
        .accessibilityHidden(true)
    case .active:
      ProgressView()
        .frame(width: 18, height: 18)
        .accessibilityHidden(true)
    case .idle:
      Circle()
        .strokeBorder(Color.ccTextTertiary.opacity(0.4), lineWidth: 1.5)
        .frame(width: 18, height: 18)
        .accessibilityHidden(true)
    }
  }

  private func stateLabel(_ state: OnboardingModel.GenerationStepState) -> String {
    switch state {
    case .done: "done"
    case .active: "in progress"
    case .idle: "waiting"
    }
  }
}
