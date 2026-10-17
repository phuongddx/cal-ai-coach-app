import CoachCalPersistence
import GRDB
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@testable import CoachCal
@testable import CoachCalDesignSystem

// Shared snapshot suite for the Progress + Coach surfaces (this plan).
// Baselines recorded on the pinned iPhone 16 / OS=18.4 destination.
@MainActor
@Suite(.snapshots(record: .failed))
struct ProgressSnapshotTests {
  private nonisolated static let fixedClock = ISO8601DateFormatter().date(
    from: "2026-09-12T09:00:00Z"
  )!

  private func makeSeededModels() async throws -> (ProgressModel, CoachModel) {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "progress-snapshots-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    let seeder = SeedDataManager(database: pool, now: { Self.fixedClock })
    try await seeder.ensureSeeded()

    let progress = ProgressModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      now: { Self.fixedClock }
    )
    let coach = CoachModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      engagement: EngagementRepository(database: pool),
      now: { Self.fixedClock }
    )
    // Let the GRDB async-sequence observation deliver the first values.
    for _ in 0..<100 {
      if progress.snapshot.weights.count == 8, progress.snapshot.streak != nil,
        progress.snapshot.badges.count == 5, !coach.insights.isEmpty
      {
        break
      }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(progress.snapshot.weights.count == 8)
    #expect(progress.snapshot.streak != nil)
    #expect(progress.snapshot.badges.count == 5)
    #expect(!coach.insights.isEmpty)
    return (progress, coach)
  }

  private func renderedImage(_ view: some View, edSafe: Bool, dark: Bool) -> UIImage {
    let wrapped = view
      .environment(\.edSafeMode, edSafe)
      .environment(\.colorScheme, dark ? .dark : .light)
      .frame(width: 390, height: 844)
      .ccAnimationDisabled(true)

    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    window.rootViewController = UIHostingController(rootView: wrapped)
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

  @Test func coachSnapshotMatrix() async throws {
    let (_, coach) = try await makeSeededModels()
    let view = CoachView(model: coach, greeting: "Good afternoon! 👋")

    assertSnapshot(
      of: renderedImage(view, edSafe: false, dark: false),
      as: .image,
      named: "coach-light"
    )
    assertSnapshot(
      of: renderedImage(view, edSafe: false, dark: true),
      as: .image,
      named: "coach-dark"
    )
    assertSnapshot(
      of: renderedImage(view, edSafe: true, dark: false),
      as: .image,
      named: "coach-edsafe-light"
    )
  }

  @Test func achievementsSnapshot() async throws {
    let (progress, _) = try await makeSeededModels()

    assertSnapshot(
      of: renderedImage(AchievementsView(model: progress), edSafe: false, dark: false),
      as: .image,
      named: "achievements-light"
    )
  }

  @Test func weightTrendSnapshot() async throws {
    let (progress, _) = try await makeSeededModels()

    assertSnapshot(
      of: renderedImage(WeightTrendView(model: progress), edSafe: false, dark: false),
      as: .image,
      named: "weighttrend-light"
    )
  }

  // ED-Safe backstop: the weekly-energy card must vanish entirely from the
  // Progress stack (deficit is calorie framing).
  @Test func progressEdSafeHidesWeeklyEnergy() async throws {
    let (progress, _) = try await makeSeededModels()
    let stack = VStack(alignment: .leading, spacing: 16) {
      WeightTrendView(model: progress)
      WeeklyEnergyView(model: progress)
      AchievementsView(model: progress)
    }
    .padding(16)

    assertSnapshot(
      of: renderedImage(stack, edSafe: true, dark: false),
      as: .image,
      named: "progress-edsafe-light"
    )
  }
}
