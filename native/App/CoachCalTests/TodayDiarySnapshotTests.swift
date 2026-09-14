import CoachCalPersistence
import GRDB
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@testable import CoachCal
@testable import CoachCalDesignSystem

// Shared snapshot suite for this plan's Today + Diary surfaces.
// Replaces 03-02's thin TodaySnapshotTests baselines with the full build-out.
@MainActor
@Suite(.snapshots(record: .failed))
struct TodayDiarySnapshotTests {
  private nonisolated static let fixedClock = ISO8601DateFormatter().date(
    from: "2026-09-12T09:00:00Z"
  )!

  private func makeSeededModel() async throws -> TodayModel {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "today-diary-snapshots-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    let seeder = SeedDataManager(database: pool, now: { Self.fixedClock })
    try await seeder.ensureSeeded()
    let model = TodayModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      now: { Self.fixedClock }
    )
    // Let the GRDB async-sequence observation deliver the first snapshot.
    for _ in 0..<100 {
      if model.goalKcal != nil, !model.snapshot.meals.isEmpty, model.streakState != nil {
        break
      }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(model.goalKcal != nil)
    #expect(!model.snapshot.meals.isEmpty)
    #expect(model.streakState != nil)
    return model
  }

  private func renderedImage(_ model: TodayModel, edSafe: Bool, dark: Bool) -> UIImage {
    let view = TodayView(model: model)
      .environment(\.edSafeMode, edSafe)
      .environment(\.colorScheme, dark ? .dark : .light)
      .frame(width: 390, height: 844)
      .ccAnimationDisabled(true)

    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
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

  @Test func todayScreenSnapshotMatrix() async throws {
    let model = try await makeSeededModel()

    assertSnapshot(
      of: renderedImage(model, edSafe: false, dark: false),
      as: .image,
      named: "today-light"
    )
    assertSnapshot(
      of: renderedImage(model, edSafe: false, dark: true),
      as: .image,
      named: "today-dark"
    )
    assertSnapshot(
      of: renderedImage(model, edSafe: true, dark: false),
      as: .image,
      named: "today-edsafe-light"
    )
    assertSnapshot(
      of: renderedImage(model, edSafe: true, dark: true),
      as: .image,
      named: "today-edsafe-dark"
    )
  }
}
