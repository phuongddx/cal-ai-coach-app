import CoachCalCore
import CoachCalPersistence
import GRDB
import XCTest

@testable import CoachCal

nonisolated final class DiaryWaterExerciseTests: XCTestCase {
  private var pool: DatabasePool!
  private var seeder: SeedDataManager!

  override func setUpWithError() throws {
    try super.setUpWithError()
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "diary-water-exercise-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    seeder = SeedDataManager(database: pool)
  }

  @MainActor
  private func makeTodayModel(now: @escaping @Sendable () -> Date) -> TodayModel {
    TodayModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      now: now
    )
  }

  @MainActor
  private func makeDiaryModel(now: @escaping @Sendable () -> Date) -> DiaryDayModel {
    DiaryDayModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      day: now(),
      now: now
    )
  }

  @MainActor
  private func waitForToday(
    _ model: TodayModel,
    _ condition: (TodayModel) -> Bool
  ) async throws {
    for _ in 0..<100 {
      if condition(model) { return }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTFail("TodayModel observation never satisfied the condition (waterMl=\(model.waterMl))")
  }

  @MainActor
  private func waitForDiary(
    _ model: DiaryDayModel,
    _ condition: (DiaryDayModel) -> Bool
  ) async throws {
    for _ in 0..<100 {
      if condition(model) { return }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTFail("DiaryDayModel observation never satisfied the condition")
  }

  @MainActor
  func testWaterQuickAddDayTotalAndClampAtZero() async throws {
    try await seeder.ensureSeeded()
    let clock = Date()
    let day = DiaryDayModel.dayString(clock)
    let tracking = TrackingRepository(database: pool)
    let userId = AppEnvironment.demoUserId

    let seededTotal = try await tracking.water(forDay: day)
    XCTAssertEqual(seededTotal, 1250, "seed carries 5×250 ml")

    try await tracking.addWater(ml: 250, day: day, userId: userId, at: clock)
    let afterAdd = try await tracking.water(forDay: day)
    XCTAssertEqual(afterAdd, 1500)

    let model = makeTodayModel(now: { clock })
    try await waitForToday(model) { $0.waterMl == 1500 }

    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 1250 }

    // Drain to zero, then subtract again — the clamp must hold at exactly 0.
    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 1000 }
    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 750 }
    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 500 }
    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 250 }
    try await model.logWaterDelta(-250)
    try await waitForToday(model) { $0.waterMl == 0 }
    try await model.logWaterDelta(-250)
    let final = try await tracking.water(forDay: day)
    XCTAssertEqual(final, 0, "water total must clamp at 0 ml, got \(final)")
  }

  @MainActor
  func testExerciseAddPersistsAndDayQueryReturnsIt() async throws {
    try await seeder.ensureSeeded()
    let clock = Date()
    let day = DiaryDayModel.dayString(clock)
    let model = makeDiaryModel(now: { clock })

    try await model.addExercise(type: "cycling", durationMin: 45, kcalBurned: 420)
    try await waitForDiary(model) { model in
      model.snapshot.exercises.contains { $0.type == "cycling" }
    }

    let tracking = TrackingRepository(database: pool)
    let exercises = try await tracking.exercises(forDay: day)
    let added = exercises.first { $0.exerciseType == "cycling" }
    XCTAssertEqual(added?.durationMin, 45)
    XCTAssertEqual(added?.kcalBurned, 420)
    // Seeded exercises remain untouched.
    XCTAssertTrue(exercises.contains { $0.exerciseType == "running" })
  }

  @MainActor
  func testTombstoneRemovesJoinRowAndEnqueuesExactlyOnePendingOp() async throws {
    try await seeder.ensureSeeded()
    let clock = Date()
    let day = DiaryDayModel.dayString(clock)
    let model = makeDiaryModel(now: { clock })
    try await waitForDiary(model) { !$0.items(in: "dinner").isEmpty }

    // Today's seed carries exactly one meal (Spaghetti Bolognese, dinner).
    let dinner = try XCTUnwrap(model.items(in: "dinner").first)
    XCTAssertEqual(dinner.title, "Spaghetti Bolognese")

    try await model.delete(dinner)

    // The detail join loses the row and the mirror row is tombstoned (not hard
    // deleted); exactly one outbox op is enqueued on top of the seed's zero.
    let details = try await DiaryDetailRepository(database: pool)
      .details(forDay: day, mealSlot: "dinner")
    XCTAssertTrue(details.isEmpty, "deleted entry must vanish from the details join")

    let entry = try await pool.read { [dinnerId = dinner.id] database in
      try DiaryEntry.fetchOne(database, key: dinnerId)
    }
    XCTAssertNotNil(entry?.deletedAt, "delete must tombstone the mirror row, not hard-delete it")

    let pendingOps = try await pool.read { database in
      try PendingOp.fetchCount(database)
    }
    XCTAssertEqual(pendingOps, 1, "tombstone must enqueue exactly one pending_op (seed leaves 0)")

    try await waitForDiary(model) { $0.items(in: "dinner").isEmpty }
  }

  @MainActor
  func testSectionKcalSumsDetailValuesProducedByKcalArithmetic() async throws {
    try await seeder.ensureSeeded()
    let clock = Date()
    let model = makeDiaryModel(now: { clock })
    try await waitForDiary(model) { !$0.items(in: "dinner").isEmpty }

    let dinner = try XCTUnwrap(model.items(in: "dinner").first)
    // Seed writes kcal via KcalArithmetic — 155 per100g × 350 g → 543.
    XCTAssertEqual(dinner.kcal, KcalArithmetic.mealKcal(per100gKcal: 155, grams: 350))
    let dinnerSection = try XCTUnwrap(model.snapshot.sections.first { $0.slot == "dinner" })
    XCTAssertEqual(model.sectionKcal(dinnerSection), dinner.kcal)
    XCTAssertEqual(model.eatenKcal, dinner.kcal, "today carries exactly one seeded meal")
  }

  // Manual-log kcal must equal round(per100g × grams / 100) at every stepper
  // value — never a user-typed or stored display value (T-P04-01).
  @MainActor
  func testManualLogKcalMatchesKcalArithmeticAtEveryStepperValue() async throws {
    try await seeder.ensureSeeded()
    for grams in stride(from: 0, through: 500, by: 50) {
      XCTAssertEqual(
        DiaryMath.manualKcal(per100gKcal: 165, grams: grams),
        KcalArithmetic.mealKcal(per100gKcal: 165, grams: grams),
        "grams=\(grams)"
      )
    }
    // Chicken Breast row: default grams 150 → 165 × 150 / 100 → 248.
    XCTAssertEqual(DiaryMath.manualKcal(per100gKcal: 165, grams: 150), 248)

    // Integration: the manual-log write stores exactly the computed kcal.
    let clock = Date()
    let detail = DiaryEntryDetail(
      entryId: UUID(),
      mealSlot: "lunch",
      title: "Chicken Breast",
      grams: 150,
      kcal: DiaryMath.manualKcal(per100gKcal: 165, grams: 150),
      proteinG: nil,
      carbsG: nil,
      fatG: nil,
      fiberG: nil,
      confidence: nil,
      hiddenFatLikely: false,
      source: "manual",
      unresolved: false,
      scanId: nil
    )
    let entry = DiaryEntry(
      id: detail.entryId,
      userId: AppEnvironment.demoUserId,
      displayText: detail.title,
      createdAt: clock,
      updatedAt: clock,
      deletedAt: nil,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: clock
    )
    let diary = DiaryEntryRepository(database: pool)
    _ = try await diary.recordUpsert(entry, now: clock)
    try await DiaryDetailRepository(database: pool).upsert(detail)

    let stored = try await pool.read { [detailId = detail.entryId] database in
      try DiaryEntryDetail.fetchOne(database, key: detailId)
    }
    XCTAssertEqual(stored?.kcal, 248)
    let pendingOps = try await pool.read { database in
      try PendingOp.fetchCount(database)
    }
    XCTAssertEqual(pendingOps, 1, "manual log enqueues exactly one diary outbox op")
  }

  @MainActor
  func testServingKcalScalesByServings() {
    XCTAssertEqual(DiaryMath.servingKcal(perServingKcal: 240, servings: 1), 240)
    XCTAssertEqual(DiaryMath.servingKcal(perServingKcal: 240, servings: 2), 480)
  }

  @MainActor
  func testCustomFoodSaveThenSearchFindsIt() async throws {
    try await seeder.ensureSeeded()
    let catalog = CatalogRepository(database: pool)
    let custom = CustomFood(
      id: UUID(),
      userId: AppEnvironment.demoUserId,
      name: "Mila Punch",
      basis: "per100g",
      kcal: 120,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      servingGrams: nil,
      createdAt: Date()
    )
    try await catalog.saveCustomFood(custom)

    let stored = try await catalog.customFoods()
    XCTAssertTrue(stored.contains { $0.name == "Mila Punch" }, "saveCustomFood must persist")

    let model = FoodSearchModel(catalog: catalog)
    await model.applySearch("punch")
    XCTAssertTrue(
      model.results.contains { $0.name == "Mila Punch" },
      "search must surface saved custom foods, got: \(model.results.map(\.name))"
    )
  }
}
