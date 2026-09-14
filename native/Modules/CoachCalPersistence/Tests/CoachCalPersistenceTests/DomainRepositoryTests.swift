import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct DomainRepositoryTests {
  private struct Repositories {
    let target: TargetRepository
    let detail: DiaryDetailRepository
    let catalog: CatalogRepository
    let tracking: TrackingRepository
    let engagement: EngagementRepository
    let pool: DatabasePool
  }

  private let user = UUID(uuidString: "04BBB783-BBE3-4A11-BE45-6B77E3D23B20")!
  private let timestamp = Date(timeIntervalSince1970: 1_768_300_000)

  private func makeRepositories() throws -> Repositories {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let pool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(pool)
    return Repositories(
      target: TargetRepository(database: pool),
      detail: DiaryDetailRepository(database: pool),
      catalog: CatalogRepository(database: pool),
      tracking: TrackingRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      pool: pool
    )
  }

  private func makeTarget() -> UserTarget {
    UserTarget(
      id: UUID(),
      userId: user,
      dailyKcal: 2150,
      proteinG: 130,
      carbsG: 220,
      fatG: 70,
      fiberGoalG: 30,
      waterGlasses: 8,
      sex: "female",
      heightCm: 165,
      weightKg: 82.4,
      goalWeightKg: 74,
      paceKgPerWeek: 0.5,
      activity: "moderate",
      goal: "lose",
      updatedAt: timestamp
    )
  }

  private func makeFood(name: String) -> Food {
    Food(
      id: UUID(),
      name: name,
      brand: nil,
      per100gKcal: 145,
      proteinG: 27,
      carbsG: 40,
      fatG: 4,
      fiberG: 2,
      servingGrams: 200,
      isCustom: false,
      createdAt: timestamp
    )
  }

  private func makeDetail(entryId: UUID, mealSlot: String) -> DiaryEntryDetail {
    DiaryEntryDetail(
      entryId: entryId,
      mealSlot: mealSlot,
      title: "Chicken Rice Bowl",
      grams: 320,
      kcal: 464,
      proteinG: 86.4,
      carbsG: 128,
      fatG: 12.8,
      fiberG: 6.4,
      confidence: 0.92,
      hiddenFatLikely: false,
      source: "cache",
      unresolved: false,
      scanId: nil
    )
  }

  private func insertDiaryEntry(
    _ pool: DatabasePool,
    id: UUID,
    createdAt: Date,
    deletedAt: Date? = nil
  ) async throws {
    let entry = DiaryEntry(
      id: id,
      userId: user,
      displayText: "Chicken Rice Bowl",
      createdAt: createdAt,
      updatedAt: createdAt,
      deletedAt: deletedAt,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: createdAt
    )
    try await pool.write { try entry.insert($0) }
  }

  private func pendingOpsCount(_ pool: DatabasePool) async throws -> Int {
    try await pool.read { try PendingOp.fetchCount($0) }
  }

  private func dayString(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
  }

  @Test
  func targetSaveReadRoundtrip() async throws {
    let repos = try makeRepositories()
    var target = makeTarget()

    try await repos.target.saveTarget(target)
    let stored = try await repos.target.activeTarget(user: user)
    #expect(stored == target)

    target.dailyKcal = 1900
    try await repos.target.saveTarget(target)
    let updated = try await repos.target.activeTarget(user: user)
    #expect(updated?.dailyKcal == 1900)

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func waterAddsAccumulatePerDay() async throws {
    let repos = try makeRepositories()
    let day = dayString(timestamp)

    try await repos.tracking.addWater(ml: 250, day: day, userId: user, at: timestamp)
    try await repos.tracking.addWater(ml: 250, day: day, userId: user, at: timestamp)
    try await repos.tracking.addWater(ml: 750, day: day, userId: user, at: timestamp)

    let total = try await repos.tracking.water(forDay: day)
    #expect(total == 1250)

    let otherDay = try await repos.tracking.water(forDay: "1999-01-01")
    #expect(otherDay == 0)

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func weightsReturnsMostRecentAscending() async throws {
    let repos = try makeRepositories()

    let kgByOffset = [82.5, 82.25, 82.0]
    for offset in 0..<3 {
      let day = dayString(timestamp.addingTimeInterval(Double(offset) * 86_400))
      let log = WeightLog(
        id: UUID(),
        userId: user,
        day: day,
        kg: kgByOffset[offset],
        createdAt: timestamp.addingTimeInterval(Double(offset) * 86_400)
      )
      try await repos.tracking.addWeight(log)
    }

    let recentTwo = try await repos.tracking.weights(limit: 2)
    #expect(recentTwo.count == 2)
    #expect(recentTwo.map(\.kg) == [82.25, 82.0])

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func savedMealsInsertListDelete() async throws {
    let repos = try makeRepositories()

    let first = SavedMeal(
      id: UUID(),
      userId: user,
      name: "Chicken Rice Bowl",
      symbol: "fork.knife",
      kcal: 464,
      itemsJson: "[{\"name\":\"Chicken Rice Bowl\",\"grams\":320}]",
      createdAt: timestamp
    )
    let second = SavedMeal(
      id: UUID(),
      userId: user,
      name: "Protein Oats",
      symbol: nil,
      kcal: 380,
      itemsJson: "[]",
      createdAt: timestamp.addingTimeInterval(60)
    )

    try await repos.catalog.saveMeal(first)
    try await repos.catalog.saveMeal(second)

    var meals = try await repos.catalog.savedMeals()
    #expect(meals.count == 2)
    #expect(meals.first?.name == "Protein Oats")

    try await repos.catalog.deleteSavedMeal(id: first.id)
    meals = try await repos.catalog.savedMeals()
    #expect(meals.map(\.id) == [second.id])

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func customFoodsSaveAndList() async throws {
    let repos = try makeRepositories()

    let custom = CustomFood(
      id: UUID(),
      userId: user,
      name: "Homemade Protein Shake",
      basis: "per_serving",
      kcal: 240,
      proteinG: 30,
      carbsG: 18,
      fatG: 4,
      fiberG: 2,
      servingGrams: 400,
      createdAt: timestamp
    )
    try await repos.catalog.saveCustomFood(custom)

    let foods = try await repos.catalog.customFoods()
    #expect(foods == [custom])

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func searchFoodsMatchesSeededNamesOrderedByName() async throws {
    let repos = try makeRepositories()

    let foods = [
      makeFood(name: "Chicken Burrito"),
      makeFood(name: "chicken soup"),
      makeFood(name: "Beef Stew"),
      makeFood(name: "Grilled Chicken"),
    ]
    for food in foods {
      try await repos.pool.write { try food.insert($0) }
    }

    let chicken = try await repos.catalog.searchFoods(query: "CHICKEN")
    #expect(chicken.map(\.name) == ["Chicken Burrito", "Grilled Chicken", "chicken soup"])

    let percentQuery = try await repos.catalog.searchFoods(query: "100%chick_en")
    #expect(percentQuery.isEmpty)

    let recent = try await repos.catalog.recentFoods(limit: 2)
    #expect(recent.count == 2)

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func detailUpsertAndJoinRespectSoftDeletedDiaryEntries() async throws {
    let repos = try makeRepositories()
    let liveEntryId = UUID()
    let deletedEntryId = UUID()

    try await insertDiaryEntry(repos.pool, id: liveEntryId, createdAt: timestamp)
    try await insertDiaryEntry(
      repos.pool,
      id: deletedEntryId,
      createdAt: timestamp.addingTimeInterval(3_600),
      deletedAt: timestamp.addingTimeInterval(3_600)
    )

    let liveDetail = makeDetail(entryId: liveEntryId, mealSlot: "lunch")
    let deletedDetail = makeDetail(entryId: deletedEntryId, mealSlot: "dinner")
    try await repos.detail.upsert(liveDetail)
    try await repos.detail.upsert(deletedDetail)

    let day = dayString(timestamp)
    let lunch = try await repos.detail.details(forDay: day, mealSlot: "lunch")
    #expect(lunch == [liveDetail])

    let dinner = try await repos.detail.details(forDay: day, mealSlot: "dinner")
    #expect(dinner.isEmpty, "Details of soft-deleted diary entries must not render")

    let single = try await repos.detail.detail(forEntryId: liveEntryId)
    #expect(single == liveDetail)

    try await repos.detail.delete(entryId: liveEntryId)
    let deleted = try await repos.detail.detail(forEntryId: liveEntryId)
    #expect(deleted == nil)

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }

  @Test
  func engagementRoundtripsStreakBadgesAndInsights() async throws {
    let repos = try makeRepositories()
    let day = dayString(timestamp)

    var streak = StreakState(
      id: 1,
      currentStreak: 12,
      bestStreak: 18,
      freezesLeft: 1,
      freezeUsedOn: nil,
      lastLoggedDay: day
    )
    try await repos.engagement.saveStreakState(streak)
    let storedStreak = try await repos.engagement.streakState()
    #expect(storedStreak == streak)

    streak.currentStreak = 13
    try await repos.engagement.saveStreakState(streak)
    let updatedStreak = try await repos.engagement.streakState()
    #expect(updatedStreak?.currentStreak == 13)

    let earned = Badge(
      id: UUID(),
      userId: user,
      code: "first-scan",
      label: "First Scan",
      detail: "Logged your first meal",
      earnedAt: timestamp,
      progress: 1,
      target: 1
    )
    let locked = Badge(
      id: UUID(),
      userId: user,
      code: "streak-30",
      label: "30-Day Streak",
      detail: nil,
      earnedAt: nil,
      progress: 12,
      target: 30
    )
    try await repos.engagement.awardBadge(earned)
    try await repos.engagement.awardBadge(locked)
    let badges = try await repos.engagement.badges()
    #expect(badges.count == 2)
    #expect(Set(badges.map(\.code)) == ["first-scan", "streak-30"])

    let insight = Insight(
      id: UUID(),
      userId: user,
      day: day,
      kind: "hydration",
      title: "Hydration is behind",
      body: "Aim for 2L by evening.",
      createdAt: timestamp
    )
    try await repos.pool.write { try insight.insert($0) }
    let insights = try await repos.engagement.insights(forDay: day)
    #expect(insights == [insight])
    let otherDay = try await repos.engagement.insights(forDay: "1999-01-01")
    #expect(otherDay.isEmpty)

    let exercise = ExerciseLog(
      id: UUID(),
      userId: user,
      day: day,
      exerciseType: "running",
      durationMin: 30,
      kcalBurned: 300,
      createdAt: timestamp
    )
    try await repos.tracking.addExercise(exercise)
    let exercises = try await repos.tracking.exercises(forDay: day)
    #expect(exercises == [exercise])

    #expect(try await pendingOpsCount(repos.pool) == 0)
  }
}
