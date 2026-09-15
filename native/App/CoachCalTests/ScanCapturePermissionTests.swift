import SwiftUI
import ViewInspector
import XCTest

@testable import CoachCal

// WR-03 coverage: the device seam must resolve permission before configuring
// the session, and a denied session must render the permission card with a
// Settings escape and library fallback — never a dead reticle with no prompt.
@MainActor
final class ScanCapturePermissionTests: XCTestCase {
  func testFixtureCaptureSeamAlwaysReportsAccessGranted() async {
    let service = FixtureCaptureService(mode: .photo)
    let granted = await service.requestAccessIfNeeded()
    XCTAssertTrue(granted, "the fixture seam never touches AVCapture, so it is always granted")
  }

  func testDeniedPermissionCardRendersCopyAndSettingsEscape() throws {
    let model = ScanModel(
      api: FixtureApiClient(bundle: .main),
      persistence: nil,
      userId: AppEnvironment.demoUserId,
      now: { Date(timeIntervalSince1970: 1_760_000_000) },
      mealSlot: .lunch
    )
    let view = CaptureViewfinderView(
      model: model,
      mode: .photo,
      onModeChange: { _ in },
      onLoggedElsewhere: {},
      isCameraAccessDenied: true
    )
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Camera access is off"), "texts: \(texts)")
    XCTAssertTrue(
      texts.contains { $0.contains("pick a photo from your library") },
      "the library fallback must be offered alongside Settings: \(texts)"
    )
    let settingsButton = try view.inspect().find(ViewType.Button.self) { button in
      (try? button.accessibilityIdentifier()) == "scan.openSettings"
    }
    XCTAssertEqual(try settingsButton.accessibilityIdentifier(), "scan.openSettings")
  }

  func testGrantedStateHidesPermissionCard() throws {
    let model = ScanModel(
      api: FixtureApiClient(bundle: .main),
      persistence: nil,
      userId: AppEnvironment.demoUserId,
      now: { Date(timeIntervalSince1970: 1_760_000_000) },
      mealSlot: .lunch
    )
    let view = CaptureViewfinderView(
      model: model,
      mode: .photo,
      onModeChange: { _ in },
      onLoggedElsewhere: {}
    )
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertFalse(
      texts.contains("Camera access is off"),
      "the permission card must stay hidden while access is granted: \(texts)"
    )
  }
}
