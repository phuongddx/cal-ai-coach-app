import CoachCalPersistence
import GRDB
import XCTest

@testable import CoachCal
@testable import CoachCalDesignSystem

nonisolated final class StreakBadgeInsightTests: XCTestCase {
  private var pool: DatabasePool!

  override func setUpWithError() throws {
    try super.setUpWithError()
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "streak-badge-insight-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
  }

  @MainActor
  private func makeCoachedFixtures() async throws -> (CoachModel, ProgressModel, Date) {
    let clock = Date()
    let seeder = SeedDataManager(database: pool, now: { clock })
    try await seeder.ensureSeeded()
    let coach = CoachModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      engagement: EngagementRepository(database: pool),
      now: { clock }
    )
    let progress = ProgressModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      now: { clock }
    )
    for _ in 0..<100 {
      if !coach.insights.isEmpty, progress.snapshot.streak != nil,
        progress.snapshot.badges.count == 5
      {
        break
      }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    return (coach, progress, clock)
  }

  // Insights render only from seeded data — no adaptive nudges (COA2-01 v2).
  @MainActor
  func testSeededInsightsRenderThreeDailyTips() async throws {
    let (coach, _, _) = try await makeCoachedFixtures()

    XCTAssertEqual(coach.insights.count, 3)
    XCTAssertEqual(
      coach.insights.map(\.title),
      [
        "12-day streak going strong",
        "Hydration is behind",
        "Protein pacing looks good",
      ],
      "insights follow the seeded rows, newest first"
    )
  }

  @MainActor
  func testWeeklyReviewStatsMatchDiaryAndWeightFixtures() async throws {
    let (coach, _, clock) = try await makeCoachedFixtures()

    // Independent derivation from the raw fixtures:
    let calendar = CoachModel.databaseCalendar
    let weekStart = Self.dayString(calendar.date(byAdding: .day, value: -6, to: clock)!, calendar: calendar)
    let today = Self.dayString(clock, calendar: calendar)
    let userId = AppEnvironment.demoUserId
    let dayKcals = try await pool.read { database -> [(day: String, kcal: Int)] in
      let rows = try Row.fetchAll(
        database,
        sql: """
          SELECT date(e.created_at) AS day, COALESCE(SUM(d.kcal), 0) AS kcal
          FROM diary_entries e
          JOIN diary_entry_details d ON d.entry_id = e.id
          WHERE e.deleted_at IS NULL AND date(e.created_at) >= ?
          GROUP BY day
          """,
        arguments: [weekStart]
      )
      return rows.map { (day: $0["day"] as String, kcal: $0["kcal"] as Int) }
    }
    XCTAssertEqual(dayKcals.count, 7, "seed logs exactly one meal per day for 7 days")
    let target = try await pool.read { database -> UserTarget? in
      try UserTarget.filter(Column("user_id") == userId).fetchOne(database)
    }
    let targetKcal = target?.dailyKcal
    let expectedOnTarget = dayKcals.filter { day in
      guard let targetKcal else { return false }
      return day.kcal <= targetKcal
    }.count
    XCTAssertEqual(expectedOnTarget, 7)

    let weekWeights = try await pool.read { database -> [WeightLog] in
      try WeightLog
        .filter(Column("day") >= weekStart)
        .filter(Column("day") <= today)
        .fetchAll(database)
    }
    let expectedKgDelta: Double = weekWeights.count >= 2
      ? weekWeights.map(\.kg).last! - weekWeights.map(\.kg).first!
      : 0

    XCTAssertEqual(coach.weekStats.daysLogged, 7)
    XCTAssertEqual(coach.weekStats.daysOnTarget, expectedOnTarget)
    XCTAssertEqual(coach.weekStats.weeksAllLogged, 1, "only the current week is fully logged")
    XCTAssertEqual(coach.weekStats.kgThisWeek, expectedKgDelta, accuracy: 0.001)
    XCTAssertEqual(coach.targetKcal, 2150)

    // Visible stats (non-ED-Safe): 100% on target, habit encouragement.
    // (Pure core lives in the DS component; the feature holds no policy branch.)
    let visible = CCWeeklyReviewStats.visibleStats(
      daysLogged: coach.weekStats.daysLogged,
      daysOnTarget: coach.weekStats.daysOnTarget,
      weeksAllLogged: coach.weekStats.weeksAllLogged,
      kgThisWeek: coach.weekStats.kgThisWeek,
      edSafeMode: false
    )
    XCTAssertTrue(visible.contains { $0.label == "% on target" && $0.value == "100%" })
    XCTAssertTrue(
      visible.contains { $0.label == "kg this week" && $0.value == CCWeeklyReviewStats.kgValue(expectedKgDelta) }
    )
    XCTAssertEqual(
      WeeklyReviewCard.encouragement(daysLogged: 7),
      "You logged every day this week — great consistency!"
    )
  }

  // ED-Safe swaps the two kcal-derived stats for "weeks with all meals logged".
  @MainActor
  func testEdSafeSwapsKcalDerivedStatsForWeeksStat() async throws {
    let (coach, _, _) = try await makeCoachedFixtures()

    let normal = CCWeeklyReviewStats.visibleStats(
      daysLogged: coach.weekStats.daysLogged,
      daysOnTarget: coach.weekStats.daysOnTarget,
      weeksAllLogged: coach.weekStats.weeksAllLogged,
      kgThisWeek: coach.weekStats.kgThisWeek,
      edSafeMode: false
    )
    XCTAssertTrue(normal.contains { $0.label == "Days logged" })
    XCTAssertTrue(normal.contains { $0.label == "% on target" })
    XCTAssertTrue(normal.contains { $0.label == "kg this week" })
    XCTAssertFalse(normal.contains { $0.label == "Weeks with all meals logged" })

    let edSafe = CCWeeklyReviewStats.visibleStats(
      daysLogged: coach.weekStats.daysLogged,
      daysOnTarget: coach.weekStats.daysOnTarget,
      weeksAllLogged: coach.weekStats.weeksAllLogged,
      kgThisWeek: coach.weekStats.kgThisWeek,
      edSafeMode: true
    )
    XCTAssertTrue(edSafe.contains { $0.label == "Days logged" })
    XCTAssertTrue(
      edSafe.contains { $0.label == "Weeks with all meals logged" && $0.value == "1" }
    )
    XCTAssertFalse(edSafe.contains { $0.label == "% on target" })
    XCTAssertFalse(edSafe.contains { $0.label == "kg this week" })
  }

  // Greeting buckets at 08:00 / 14:00 / 21:00 under fixed clocks.
  @MainActor
  func testGreetingBucketsUnderFixedClocks() {
    let utc = CoachModel.databaseCalendar
    let formatter = ISO8601DateFormatter()
    XCTAssertEqual(
      CoachModel.greeting(for: formatter.date(from: "2026-09-15T08:00:00Z")!, calendar: utc),
      "Good morning! 👋"
    )
    XCTAssertEqual(
      CoachModel.greeting(for: formatter.date(from: "2026-09-15T14:00:00Z")!, calendar: utc),
      "Good afternoon! 👋"
    )
    XCTAssertEqual(
      CoachModel.greeting(for: formatter.date(from: "2026-09-15T21:00:00Z")!, calendar: utc),
      "Good evening! 👋"
    )
  }

  // ENG-01: the seeded 12-day streak renders through the StreakEngine
  // reconcile, the freeze stays available, and the badge grids derive
  // earned/locked + days-left copy from the seeded rows.
  @MainActor
  func testSeededStreakBadgesRenderAfterReconcile() async throws {
    let (_, progress, _) = try await makeCoachedFixtures()

    let streak = try XCTUnwrap(progress.snapshot.streak)
    XCTAssertEqual(streak.currentStreak, 12, "the seeded 12-day streak renders")
    XCTAssertEqual(streak.bestStreak, 18)
    XCTAssertEqual(streak.freezesLeft, 1)
    XCTAssertEqual(
      AchievementsView.streakTitle(current: streak.currentStreak, best: streak.bestStreak),
      "Personal best: 18 days"
    )
    // "Day 1 streak started!" surfaces from current == 1.
    XCTAssertEqual(AchievementsView.streakTitle(current: 1, best: 18), "Day 1 streak started!")

    let earned = progress.snapshot.badges.filter { $0.earnedAt != nil }
    let locked = progress.snapshot.badges.filter { $0.earnedAt == nil }
    XCTAssertEqual(earned.count, 3)
    XCTAssertEqual(locked.count, 2)
    let streak30 = try XCTUnwrap(locked.first { $0.code == "streak-30" })
    XCTAssertEqual(AchievementsView.lockedDaysLeft(streak30), 18, "30-Day badge shows 18 days left")
  }

  private static func dayString(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
  }
}
