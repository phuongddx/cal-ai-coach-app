import CoachCalDesignSystem
import SwiftUI

// UI-SPEC Analyzing: 160pt thumb (radius-lg) with a 1.5s shimmer, headings,
// 3-step checklist (completed check / spinner / idle circle) plus a 4th
// escalation-only row (Phase 4: real Tier-2 re-run past the 5s budget) and
// a Cancel affordance that returns to capture.
struct AnalyzingView: View {
  let model: ScanModel
  let animationsDisabled: Bool

  @State private var shimmerOffset: CGFloat = -1

  private var activeStep: ScanModel.AnalyzingStep? {
    if case .analyzing(let step) = model.phase { return step }
    return nil
  }

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: CCSpace.xl) {
        Spacer()
        thumbView
          .accessibilityIdentifier("scan.analyzing.thumb")
        VStack(spacing: CCSpace.xs) {
          Text("Analyzing your meal")
            .ccFont(.heading)
            .foregroundStyle(Color.white)
            .accessibilityIdentifier("scan.analyzing")
          Text("AI estimate in progress")
            .ccFont(.subhead)
            .foregroundStyle(Color.white.opacity(0.7))
        }
        checklist
          .accessibilityIdentifier("scan.analyzing")
        Spacer()
        Button("Cancel") {
          model.cancelAnalyzing()
        }
        .font(.system(size: 15, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.8))
        .padding(CCSpace.md)
        .contentShape(Rectangle())
        .accessibilityIdentifier("scan.cancel")
        .padding(.bottom, CCSpace.xl)
      }
      .padding(.horizontal, CCSpace.xl2)
    }
    .onAppear {
      guard !animationsDisabled else { return }
      withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
        shimmerOffset = 2
      }
    }
  }

  private var thumbView: some View {
    RoundedRectangle(cornerRadius: CCRadius.lg)
      .fill(Color.white.opacity(0.08))
      .frame(width: 160, height: 160)
      .overlay {
        if let image = model.captureThumb {
          Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
        } else {
          Image(systemName: "photo")
            .font(.system(size: 40))
            .foregroundStyle(Color.white.opacity(0.3))
        }
      }
      .overlay(shimmer)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
      .accessibilityHidden(true)
  }

  private var shimmer: some View {
    GeometryReader { geometry in
      LinearGradient(
        colors: [.white.opacity(0), .white.opacity(0.25), .white.opacity(0)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .frame(width: geometry.size.width * 0.6)
      .offset(x: shimmerOffset * geometry.size.width)
    }
    .allowsHitTesting(false)
  }

  private var visibleSteps: [ScanModel.AnalyzingStep] {
    activeStep == .confirming
      ? ScanModel.AnalyzingStep.allCases
      : Array(ScanModel.AnalyzingStep.allCases.prefix(3))
  }

  private var checklist: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      ForEach(visibleSteps, id: \.self) { step in
        stepRow(step)
          .accessibilityElement(children: .combine)
          .accessibilityIdentifier("scan.step.\(step.rawValue)")
      }
    }
    .padding(.vertical, CCSpace.lg)
  }

  private func stepRow(_ step: ScanModel.AnalyzingStep) -> some View {
    HStack(spacing: CCSpace.md) {
      stepIcon(step)
        .accessibilityHidden(true)
      Text(step.title)
        .ccFont(.subhead)
        .foregroundStyle(stepColor(step))
    }
  }

  @ViewBuilder private func stepIcon(_ step: ScanModel.AnalyzingStep) -> some View {
    let order = visibleSteps
    if let active = activeStep, let activeIndex = order.firstIndex(of: active),
      let index = order.firstIndex(of: step)
    {
      if index < activeIndex {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color.ccAccentLime)
      } else if index == activeIndex {
        // The live spinner's rotation angle is nondeterministic in window
        // renders; --ccDisableAnimations (snapshot/ UI-test mode) pins a
        // static representative of the same "in progress" state.
        if animationsDisabled {
          Image(systemName: "circle.dotted")
            .font(.system(size: 20))
            .foregroundStyle(Color.ccAccentLime)
        } else {
          ProgressView()
            .tint(Color.ccAccentLime)
            .frame(width: 20, height: 20)
        }
      } else {
        Circle()
          .strokeBorder(Color.white.opacity(0.2), lineWidth: 2)
          .frame(width: 20, height: 20)
      }
    } else {
      Circle()
        .strokeBorder(Color.white.opacity(0.2), lineWidth: 2)
        .frame(width: 20, height: 20)
    }
  }

  private func stepColor(_ step: ScanModel.AnalyzingStep) -> Color {
    guard let active = activeStep else { return .white.opacity(0.4) }
    let order = visibleSteps
    guard let activeIndex = order.firstIndex(of: active),
      let index = order.firstIndex(of: step)
    else { return .white.opacity(0.4) }
    return index <= activeIndex ? Color.white : Color.white.opacity(0.4)
  }
}
