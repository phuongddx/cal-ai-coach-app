import CoachCalNetworking
import CoachCalPersistence
import GRDB
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@testable import CoachCal
@testable import CoachCalDesignSystem

// TRU-04/PLT-03 phase backstop: every core screen in BOTH ED-Safe modes and
// BOTH appearances (8 screens × 2 modes × 2 appearances = 32 baselines),
// recorded once on the pinned iPhone 16 / OS=18.4 destination. This also
// closes the UI-SPEC unresolved theming row with dark snapshots per screen.
@MainActor
@Suite(.snapshots(record: .failed))
struct EdSafeSweepSnapshotTests {
  private nonisolated static let fixedClock = ISO8601DateFormatter().date(
    from: "2026-09-12T09:00:00Z"
  )!

  private func makeSeededPool() async throws -> DatabasePool {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "edsafe-sweep-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    let seeder = SeedDataManager(database: pool, now: { Self.fixedClock })
    try await seeder.ensureSeeded()
    return pool
  }

  // MARK: - Screen 1: Today

  @Test func todayMatrix() async throws {
    let pool = try await makeSeededPool()
    let model = TodayModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      now: { Self.fixedClock }
    )
    for _ in 0..<100 {
      if model.goalKcal != nil, !model.snapshot.meals.isEmpty, model.streakState != nil { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(model.goalKcal != nil)
    assertSnapshot(of: renderedImage(TodayView(model: model), edSafe: false, dark: false), as: .image, named: "sweep-today-light")
    assertSnapshot(of: renderedImage(TodayView(model: model), edSafe: false, dark: true), as: .image, named: "sweep-today-dark")
    assertSnapshot(of: renderedImage(TodayView(model: model), edSafe: true, dark: false), as: .image, named: "sweep-today-edsafe-light")
    assertSnapshot(of: renderedImage(TodayView(model: model), edSafe: true, dark: true), as: .image, named: "sweep-today-edsafe-dark")
  }

  // MARK: - Screen 2: DiaryDay

  @Test func diaryDayMatrix() async throws {
    let pool = try await makeSeededPool()
    let model = DiaryDayModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      day: Self.fixedClock,
      now: { Self.fixedClock }
    )
    for _ in 0..<100 {
      if !model.items(in: "dinner").isEmpty { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(!model.items(in: "dinner").isEmpty)
    assertSnapshot(of: renderedImage(DiaryDayView(model: model), edSafe: false, dark: false), as: .image, named: "sweep-diary-light")
    assertSnapshot(of: renderedImage(DiaryDayView(model: model), edSafe: false, dark: true), as: .image, named: "sweep-diary-dark")
    assertSnapshot(of: renderedImage(DiaryDayView(model: model), edSafe: true, dark: false), as: .image, named: "sweep-diary-edsafe-light")
    assertSnapshot(of: renderedImage(DiaryDayView(model: model), edSafe: true, dark: true), as: .image, named: "sweep-diary-edsafe-dark")
  }

  // MARK: - Screen 3: AddFood sheet

  @Test func addFoodMatrix() async throws {
    let savedMeals = [
      SavedMeal(
        id: UUID(),
        userId: AppEnvironment.demoUserId,
        name: "Chicken Rice Bowl",
        symbol: "fork.knife",
        kcal: 464,
        itemsJson: "[{\"name\":\"Chicken Rice Bowl\",\"grams\":320}]",
        createdAt: Self.fixedClock
      ),
      SavedMeal(
        id: UUID(),
        userId: AppEnvironment.demoUserId,
        name: "Protein Oats",
        symbol: nil,
        kcal: 380,
        itemsJson: "[{\"name\":\"Protein Oats\",\"grams\":250}]",
        createdAt: Self.fixedClock
      ),
    ]
    let sheet = AddFoodSheet(
      mealSlot: .lunch,
      savedMeals: savedMeals,
      onCapture: { _ in },
      onSearch: {},
      onRelog: { _ in },
      onDismiss: {}
    )
    assertSnapshot(of: renderedImage(sheet, edSafe: false, dark: false), as: .image, named: "sweep-addfood-light")
    assertSnapshot(of: renderedImage(sheet, edSafe: false, dark: true), as: .image, named: "sweep-addfood-dark")
    assertSnapshot(of: renderedImage(sheet, edSafe: true, dark: false), as: .image, named: "sweep-addfood-edsafe-light")
    assertSnapshot(of: renderedImage(sheet, edSafe: true, dark: true), as: .image, named: "sweep-addfood-edsafe-dark")
  }

  // MARK: - Screen 4: FoodSearch

  @Test func foodSearchMatrix() async throws {
    let pool = try await makeSeededPool()
    let catalog = CatalogRepository(database: pool)
    let model = FoodSearchModel(catalog: catalog)
    model.query = "chicken"
    for _ in 0..<100 {
      if !model.results.isEmpty { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(!model.results.isEmpty)
    let view = FoodSearchView(
      model: model,
      mealSlot: .lunch,
      catalog: catalog,
      userId: AppEnvironment.demoUserId,
      diaryEntryRepository: DiaryEntryRepository(database: pool),
      diaryDetailRepository: DiaryDetailRepository(database: pool),
      now: { Self.fixedClock },
      onSaved: { _ in },
      onDismiss: {}
    )
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: false), as: .image, named: "sweep-search-light")
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: true), as: .image, named: "sweep-search-dark")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: false), as: .image, named: "sweep-search-edsafe-light")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: true), as: .image, named: "sweep-search-edsafe-dark")
  }

  // MARK: - Screen 5: Review sheet

  @Test func reviewSheetMatrix() async throws {
    let model = ScanModel(
      api: FixtureApiClient(bundle: .main, scenario: .response200),
      persistence: nil,
      userId: AppEnvironment.demoUserId,
      now: { Self.fixedClock },
      mealSlot: .lunch
    )
    let response = try await FixtureApiClient(bundle: .main, scenario: .response200)
      .analyzeFood(ScanRequest(kind: .photo))
    model.receive(response)

    assertSnapshot(of: renderedImage(ReviewSheetView(model: model, onClose: {}), edSafe: false, dark: false), as: .image, named: "sweep-review-light")
    assertSnapshot(of: renderedImage(ReviewSheetView(model: model, onClose: {}), edSafe: false, dark: true), as: .image, named: "sweep-review-dark")
    assertSnapshot(of: renderedImage(ReviewSheetView(model: model, onClose: {}), edSafe: true, dark: false), as: .image, named: "sweep-review-edsafe-light")
    assertSnapshot(of: renderedImage(ReviewSheetView(model: model, onClose: {}), edSafe: true, dark: true), as: .image, named: "sweep-review-edsafe-dark")
  }

  // MARK: - Screen 6: Progress (same composition as ProgressFlow)

  @Test func progressMatrix() async throws {
    let pool = try await makeSeededPool()
    let model = ProgressModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      now: { Self.fixedClock }
    )
    for _ in 0..<100 {
      if model.snapshot.target != nil, !model.snapshot.weights.isEmpty,
        model.snapshot.streak != nil, !model.snapshot.badges.isEmpty
      { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(model.snapshot.target != nil)
    #expect(!model.snapshot.weights.isEmpty)
    let view = NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: CCSpace.lg) {
          Text("Progress")
            .ccFont(.title)
            .foregroundStyle(Color.ccTextPrimary)
          WeightTrendView(model: model)
          WeeklyEnergyView(model: model)
          AchievementsView(model: model)
        }
        .padding(CCSpace.lg)
      }
      .scrollBounceBehavior(.basedOnSize)
      .background(Color.ccBackground)
    }
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: false), as: .image, named: "sweep-progress-light")
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: true), as: .image, named: "sweep-progress-dark")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: false), as: .image, named: "sweep-progress-edsafe-light")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: true), as: .image, named: "sweep-progress-edsafe-dark")
  }

  // MARK: - Screen 7: Coach

  @Test func coachMatrix() async throws {
    let pool = try await makeSeededPool()
    let model = CoachModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      engagement: EngagementRepository(database: pool),
      now: { Self.fixedClock }
    )
    for _ in 0..<100 {
      if !model.insights.isEmpty, model.weekStats.daysLogged > 0 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(!model.insights.isEmpty)
    let view = CoachView(model: model, greeting: "Good afternoon! 👋")
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: false), as: .image, named: "sweep-coach-light")
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: true), as: .image, named: "sweep-coach-dark")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: false), as: .image, named: "sweep-coach-edsafe-light")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: true), as: .image, named: "sweep-coach-edsafe-dark")
  }

  // MARK: - Screen 8: Profile

  @Test func profileMatrix() async throws {
    let pool = try await makeSeededPool()
    let model = ProfileModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      now: { Self.fixedClock }
    )
    for _ in 0..<100 {
      if model.stats.target != nil, model.stats.latestKg != nil { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    #expect(model.stats.target != nil)
    let view = ProfileView(stats: model.stats, onOpenSettings: {})
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: false), as: .image, named: "sweep-profile-light")
    assertSnapshot(of: renderedImage(view, edSafe: false, dark: true), as: .image, named: "sweep-profile-dark")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: false), as: .image, named: "sweep-profile-edsafe-light")
    assertSnapshot(of: renderedImage(view, edSafe: true, dark: true), as: .image, named: "sweep-profile-edsafe-dark")
  }

  // MARK: - Screen 9: Settings detail (Group F; hosts the ED-Safe toggle)

  // PLT-03 theming backstop for the one Group F screen outside the original
  // 8-screen sweep: the binding tracks the mode so the ED-Safe pair shows the
  // toggle ON, as the user would see it.
  @Test func settingsMatrix() async throws {
    func settingsImage(edSafe: Bool, dark: Bool) -> UIImage {
      renderedImage(
        SettingsDetailView(
          edSafeToggle: .constant(edSafe),
          burnAddBackToggle: .constant(false),
          onDeleteAccount: {},
          csvExportAction: { Data() }
        ),
        edSafe: edSafe,
        dark: dark
      )
    }
    assertSnapshot(of: settingsImage(edSafe: false, dark: false), as: .image, named: "sweep-settings-light")
    assertSnapshot(of: settingsImage(edSafe: false, dark: true), as: .image, named: "sweep-settings-dark")
    assertSnapshot(of: settingsImage(edSafe: true, dark: false), as: .image, named: "sweep-settings-edsafe-light")
    assertSnapshot(of: settingsImage(edSafe: true, dark: true), as: .image, named: "sweep-settings-edsafe-dark")
  }

  // MARK: - Rendering

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
}
