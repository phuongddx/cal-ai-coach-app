import CoachCalCore
import SnapshotTesting
import SwiftUI
import Testing
import UIKit
import ViewInspector

@testable import CoachCalDesignSystem

// Widget SwiftUI views are snapshot-tested from the host app's test target
// by compiling the widget's view file as a plain source member here too
// (04-RESEARCH.md Supporting Stack: "no separate widget UI-test infra
// needed") — project.yml adds CoachCalWidget/CaloriesRemainingTimelineProvider.swift
// to CoachCalTests' own sources list, so CaloriesRemainingWidgetView is
// available directly, with zero @testable import across the widget boundary.
@MainActor
@Suite(.snapshots(record: .failed))
struct WidgetSnapshotSnapshotTests {
  private nonisolated static let fixedDate = ISO8601DateFormatter().date(from: "2026-09-12T09:00:00Z")!

  @Test func normalLight() {
    assertSnapshot(of: renderedImage(edSafe: false, dark: false), as: .image, named: "widget-normal-light")
  }

  @Test func normalDark() {
    assertSnapshot(of: renderedImage(edSafe: false, dark: true), as: .image, named: "widget-normal-dark")
  }

  @Test func edSafeLight() {
    assertSnapshot(of: renderedImage(edSafe: true, dark: false), as: .image, named: "widget-edsafe-light")
  }

  @Test func edSafeDark() {
    assertSnapshot(of: renderedImage(edSafe: true, dark: true), as: .image, named: "widget-edsafe-dark")
  }

  // T-P45-01: the edSafe-true rendering must never leak a raw kcal figure —
  // grep-style text check mirroring NotificationSchedulerTests's
  // edSafeRecapBodyContainsNoDigitCharacters convention.
  @Test func edSafeRenderingNeverContainsRawKcalFigure() throws {
    let view = CaloriesRemainingWidgetView(entry: entry(edSafe: true))
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    #expect(!texts.isEmpty)
    #expect(
      !texts.contains { text in text.contains { $0.isNumber } },
      "ED-Safe rendering leaked a raw kcal figure: \(texts)"
    )
  }

  private func entry(edSafe: Bool) -> CaloriesRemainingEntry {
    CaloriesRemainingEntry(date: Self.fixedDate, caloriesRemaining: 420, edSafeMode: edSafe)
  }

  private func renderedImage(edSafe: Bool, dark: Bool) -> UIImage {
    let view = CaloriesRemainingWidgetView(entry: entry(edSafe: edSafe))
      .environment(\.colorScheme, dark ? .dark : .light)
      .frame(width: 170, height: 170)
      .ccAnimationDisabled(true)

    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 170, height: 170))
    window.rootViewController = UIHostingController(rootView: view)
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
}
