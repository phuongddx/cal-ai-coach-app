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
        DescribeMealSheet(model: model, onLoggedElsewhere: { dismiss() })
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
      ReviewSheetView(model: model, onClose: { dismiss() })
    case .saved:
      ScanSavedView(
        model: model,
        onViewDiary: { dismiss() },
        onAddMore: { model.startNewScan() }
      )
    case .quotaReached:
      QuotaReachedView(model: model, onLoggedElsewhere: { dismiss() })
    }
  }

  private func buildModelIfNeeded() {
    guard model == nil else { return }
    activeMode = route.mode
    let persistence = ScanModel.Persistence(
      pool: environment.database,
      entries: environment.diaryEntryRepository,
      details: environment.diaryDetailRepository,
      targets: environment.targetRepository,
      engagement: environment.engagementRepository,
      catalog: environment.catalogRepository,
      notifyMutation: { environment.notifyLocalMutation() },
      edSafeMode: { environment.edSafeMode }
    )
    model = ScanModel(
      api: environment.api,
      persistence: persistence,
      userId: environment.currentUserId,
      now: environment.now,
      mealSlot: route.mealSlot ?? .lunch
    )
  }
}
