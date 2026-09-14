import CoachCalNetworking
import SnapshotTesting
import SwiftUI
import Testing
import UIKit
@testable import CoachCal

// Scan-surface snapshot matrix (UI-SPEC Group D), recorded once on the pinned
// iPhone 16 / OS=18.4 destination. Views are props-driven — no AppEnvironment.
// Long-title backstop pins the 60-char meal-title truncation contract.
@MainActor
@Suite(.snapshots(record: .failed))
struct ScanSnapshotTests {
  private func receivedModel(_ scenario: FixtureScenario) async throws -> ScanModel {
    let model = ScanModel(
      api: FixtureApiClient(bundle: .main, scenario: scenario),
      persistence: nil,
      userId: AppEnvironment.demoUserId,
      now: { Date(timeIntervalSince1970: 1_760_000_000) },
      mealSlot: .lunch
    )
    let response = try await FixtureApiClient(bundle: .main, scenario: scenario)
      .analyzeFood(ScanRequest(kind: .photo))
    model.receive(response)
    return model
  }

  private func rendered(_ view: some View, dark: Bool) -> UIImage {
    let content = view
      .frame(width: 390, height: 844)
      .ccAnimationDisabled(true)

    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    window.rootViewController = UIHostingController(rootView: content)
    window.overrideUserInterfaceStyle = dark ? .dark : .light
    window.makeKeyAndVisible()
    window.layoutIfNeeded()
    RunLoop.main.run(until: Date().addingTimeInterval(0.5))

    let renderer = UIGraphicsImageRenderer(size: window.bounds.size)
    let image = renderer.image { context in
      window.layer.render(in: context.cgContext)
    }
    window.isHidden = true
    return image
  }

  @Test func scanSnapshotMatrix() async throws {
    let reviewModel = try await receivedModel(.response200)
    let captureModel = try await receivedModel(.response200)
    captureModel.setPhaseForTesting(.capture)

    let analyzingModel = try await receivedModel(.response200)
    analyzingModel.setPhaseForTesting(.analyzing(.reading))

    let quotaModel = try await receivedModel(.response200)
    let resetDate = ISO8601DateFormatter().date(from: "2026-09-21T10:00:00Z")!
    quotaModel.setPhaseForTesting(.quotaReached(
      EntitlementState(tier: "free", scansUsed: 3, scanLimit: 3, windowResetAt: resetDate)
    ))

    let notFoundModel = try await receivedModel(.response200)
    notFoundModel.setPhaseForTesting(.failed(.barcodeNotFound))

    let longTitleModel = try await receivedModel(.response200)
    longTitleModel.mealTitle = "Grilled chicken rice bowl with house dressing pickled cucumber and a soft egg on top"

    assertSnapshot(
      of: rendered(
        CaptureViewfinderView(model: captureModel, mode: .photo, onModeChange: { _ in }, onLoggedElsewhere: {}),
        dark: false
      ),
      as: .image,
      named: "scan-viewfinder"
    )
    assertSnapshot(
      of: rendered(AnalyzingView(model: analyzingModel, animationsDisabled: true), dark: false),
      as: .image,
      named: "scan-analyzing"
    )
    assertSnapshot(
      of: rendered(ReviewSheetView(model: reviewModel, onClose: {}), dark: false),
      as: .image,
      named: "scan-review-light"
    )
    assertSnapshot(
      of: rendered(ReviewSheetView(model: reviewModel, onClose: {}), dark: true),
      as: .image,
      named: "scan-review-dark"
    )
    assertSnapshot(
      of: rendered(
        ReviewSheetView(model: reviewModel, onClose: {}).environment(\.edSafeMode, true),
        dark: false
      ),
      as: .image,
      named: "scan-review-edsafe"
    )
    assertSnapshot(
      of: rendered(QuotaReachedView(model: quotaModel, onLoggedElsewhere: {}), dark: false),
      as: .image,
      named: "scan-quota"
    )
    assertSnapshot(
      of: rendered(
        CaptureViewfinderView(model: notFoundModel, mode: .photo, onModeChange: { _ in }, onLoggedElsewhere: {}),
        dark: false
      ),
      as: .image,
      named: "scan-404"
    )
    assertSnapshot(
      of: rendered(ReviewSheetView(model: longTitleModel, onClose: {}), dark: false),
      as: .image,
      named: "scan-review-longtitle"
    )
  }
}
