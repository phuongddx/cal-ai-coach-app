import CoachCalDesignSystem
import CoachCalNetworking
import SwiftUI

// Routed scan flow (03-02 seam: AppEnvironment.openScan → MainShell
// fullScreenCover → ScanFlowView(route:)). Phase machine lives in ScanModel;
// this file only switches surfaces. Capture is fixture-on-simulator,
// AVFoundation/DataScanner-on-device via the CameraCaptureService seam.
struct ScanFlowView: View {
  @Environment(AppEnvironment.self) private var environment
  @Environment(\.dismiss) private var dismiss

  let route: ScanRoute

  @State private var model: ScanModel?
  @State private var activeMode: ScanMode = .photo

  var body: some View {
    Group {
      if let model {
        phaseView(model)
      } else {
        Color.black.ignoresSafeArea()
      }
    }
    .task {
      buildModelIfNeeded()
    }
  }

  @ViewBuilder private func phaseView(_ model: ScanModel) -> some View {
    switch model.phase {
    case .capture, .failed:
      if activeMode == .text {
        describePlaceholder
      } else {
        CaptureViewfinderView(
          model: model,
          mode: activeMode,
          onModeChange: { activeMode = $0 },
          onLoggedElsewhere: { dismiss() }
        )
        .id(activeMode)
      }
    case .analyzing:
      AnalyzingView(model: model, animationsDisabled: environment.animationsDisabled)
    case .review:
      reviewPlaceholder
    case .saved:
      savedPlaceholder
    case .quotaReached:
      quotaPlaceholder
    }
  }

  // Task 2 slices replace these minimal phase surfaces.
  private var reviewPlaceholder: some View {
    VStack(spacing: CCSpace.md) {
      Text("Review ready")
        .ccFont(.heading)
        .foregroundStyle(Color.white)
      if let model, model.result != nil {
        Text("\(model.mealKcal) kcal")
          .ccFont(.subhead)
          .foregroundStyle(Color.white.opacity(0.7))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.ignoresSafeArea())
    .accessibilityIdentifier("scan.review")
  }

  private var savedPlaceholder: some View {
    Text("Saved")
      .ccFont(.heading)
      .foregroundStyle(Color.white)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color.black.ignoresSafeArea())
      .accessibilityIdentifier("scan.saved")
  }

  private var quotaPlaceholder: some View {
    Text("Quota reached")
      .ccFont(.heading)
      .foregroundStyle(Color.white)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color.black.ignoresSafeArea())
      .accessibilityIdentifier("scan.quota")
  }

  private var describePlaceholder: some View {
    Text("Describe your meal")
      .ccFont(.heading)
      .foregroundStyle(Color.white)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color.black.ignoresSafeArea())
      .accessibilityIdentifier("scan.describe")
  }

  private func buildModelIfNeeded() {
    guard model == nil else { return }
    activeMode = route.mode
    let persistence = ScanModel.Persistence(
      pool: environment.database,
      entries: environment.diaryEntryRepository,
      details: environment.diaryDetailRepository,
      targets: environment.targetRepository,
      engagement: environment.engagementRepository
    )
    model = ScanModel(
      api: environment.api,
      persistence: persistence,
      userId: AppEnvironment.demoUserId,
      now: environment.now,
      mealSlot: route.mealSlot ?? .lunch
    )
  }
}
