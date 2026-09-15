import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence
import GRDB
import Testing
import UIKit
@testable import CoachCal

// T-P05-02 invariant at its most user-visible point: displayed/stored kcal is
// ALWAYS KcalArithmetic(current grams); the fixture's kcal figures feed these
// parity assertions only and can never resurface after an edit.
@MainActor
@Suite
struct ScanKcalParityTests {
  private static func makeModel(persistence: ScanModel.Persistence? = nil) -> ScanModel {
    ScanModel(
      api: FixtureApiClient(bundle: .main),
      persistence: persistence,
      userId: AppEnvironment.demoUserId,
      now: { Date(timeIntervalSince1970: 1_760_000_000) },
      mealSlot: .lunch
    )
  }

  private static func goldenResponse() async throws -> ScanResponse {
    try await FixtureApiClient(bundle: .main, scenario: .response200)
      .analyzeFood(ScanRequest(kind: .photo))
  }

  @Test func goldenParityAtFixtureGrams() async throws {
    let response = try await Self.goldenResponse()
    let model = Self.makeModel()
    model.receive(response)

    #expect(response.items.count == 1)
    #expect(response.items[0].kcal == 464)
    #expect(model.itemKcal(at: 0) == 464)
    #expect(
      model.itemKcal(at: 0)
        == KcalArithmetic.mealKcal(per100gKcal: response.items[0].per100g.kcal, grams: response.items[0].grams)
    )
    #expect(model.mealKcal == 464)
  }

  @Test func editedGramsNeverEchoFixtureKcal() async throws {
    let model = Self.makeModel()
    model.receive(try await Self.goldenResponse())

    model.setGrams(200, at: 0)
    #expect(model.itemKcal(at: 0) == 290, "145 × 200 / 100 = 290")
    #expect(model.itemKcal(at: 0) != 464, "an edited row must never display the fixture's kcal")
    #expect(model.mealKcal == 290)
  }

  @Test func mealKcalIsSumOfRecomputedItemKcal() {
    let response = Self.twoItemResponse()
    let model = Self.makeModel()
    model.receive(response)

    #expect(model.itemKcal(at: 0) == 464)
    #expect(model.itemKcal(at: 1) == 86)
    #expect(model.mealKcal == 464 + 86)

    model.setGrams(40, at: 1)
    #expect(model.itemKcal(at: 1) == 172)
    #expect(model.mealKcal == model.itemKcal(at: 0) + model.itemKcal(at: 1))
  }

  @Test func unresolvedItemGatesSaveUntilResolved() {
    var items = Self.twoItemResponse().items
    items[1] = Self.item(
      label: "house-dressing",
      grams: 20,
      per100gKcal: 430,
      confidence: 0.42,
      hiddenFatLikely: true,
      unresolved: true
    )
    let response = ScanResponse(
      scanId: UUID(uuidString: "AA000000-0000-4000-8000-00000000AA02")!,
      kind: .photo,
      items: items,
      mealKcal: 550,
      scanConfidence: 0.61,
      note: nil
    )
    let model = Self.makeModel()
    model.receive(response)

    #expect(model.hasUnresolved)
    #expect(!model.isSaveEnabled, "save must stay disabled while any item is unresolved")

    model.captureCorrection(kind: .portionOff, note: "dressing was half the portion", for: 1)
    #expect(!model.hasUnresolved)
    #expect(model.isSaveEnabled)
  }

  // WR-01: a second Save while one is in flight must be rejected — both taps
  // resolve to exactly one batch (two entries, two ops), never duplicates.
  @Test func concurrentSaveTapsProduceExactlyOneBatch() async throws {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "scan-parity-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    let persistence = ScanModel.Persistence(
      pool: pool,
      entries: DiaryEntryRepository(database: pool),
      details: DiaryDetailRepository(database: pool),
      targets: TargetRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      catalog: CatalogRepository(database: pool)
    )
    let model = Self.makeModel(persistence: persistence)
    model.receive(Self.twoItemResponse())

    async let first: Void = model.save()
    async let second: Void = model.save()
    _ = await (first, second)

    #expect(model.phase == .saved)
    let pendingOps = try await pool.read { try PendingOp.fetchCount($0) }
    #expect(pendingOps == 2, "a double-tap must not enqueue duplicate ops")
    let entryCount = try await pool.read { try DiaryEntry.fetchCount($0) }
    #expect(entryCount == 2, "a double-tap must not write duplicate entries")
  }

  @Test func saveEnqueuesOnePendingOpPerEntryAndUndoTombstones() async throws {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "scan-parity-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    let persistence = ScanModel.Persistence(
      pool: pool,
      entries: DiaryEntryRepository(database: pool),
      details: DiaryDetailRepository(database: pool),
      targets: TargetRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      catalog: CatalogRepository(database: pool)
    )
    let model = Self.makeModel(persistence: persistence)
    let response = Self.twoItemResponse()
    model.receive(response)
    model.setGrams(200, at: 0)

    await model.save()

    #expect(model.phase == .saved)
    #expect(model.savedKcal == 290 + 86)
    let pendingAfterSave = try await pool.read { try PendingOp.fetchCount($0) }
    #expect(pendingAfterSave == 2, "exactly one pending op per saved entry")

    let details = try await pool.read { try DiaryEntryDetail.fetchAll($0) }
    #expect(details.count == 2)
    let firstDetail = try #require(details.first { $0.title == model.mealTitle })
    #expect(firstDetail.kcal == 290, "stored kcal is the recomputed figure, never the fixture's 464")
    #expect(firstDetail.grams == 200)
    #expect(firstDetail.scanId == response.scanId.uuidString)
    #expect(firstDetail.source == "scan")

    // LOG-07: the save feeds the saved-meals rail contract 03-04 re-logs from.
    let savedMeals = try await CatalogRepository(database: pool).savedMeals()
    let railMeal = try #require(savedMeals.first { $0.name == model.mealTitle })
    #expect(railMeal.kcal == 290 + 86)
    let railItems = try JSONDecoder().decode([ScanModel.SavedMealItemPayload].self, from: Data(railMeal.itemsJson.utf8))
    #expect(railItems.map(\.grams) == [200, 20])
    #expect(
      railItems.map(\.kcal) == [290, 86],
      "each payload row carries its own KcalArithmetic figure, never the aggregate"
    )

    await model.undo()

    #expect(model.phase == .review)
    let pendingAfterUndo = try await pool.read { try PendingOp.fetchCount($0) }
    #expect(pendingAfterUndo == 4, "undo tombstones both entries (2 more ops)")
    let detailsAfterUndo = try await pool.read { try DiaryEntryDetail.fetchAll($0) }
    #expect(detailsAfterUndo.isEmpty)
    let entries = try await pool.read { try DiaryEntry.fetchAll($0) }
    #expect(entries.allSatisfy { $0.deletedAt != nil })
  }

  // MARK: - Synthetic responses (public DTO memberwise inits)

  private static func item(
    label: String,
    grams: Int,
    per100gKcal: Int,
    confidence: Double,
    hiddenFatLikely: Bool,
    unresolved: Bool
  ) -> ScanItem {
    let per100g = Per100g(
      kcal: per100gKcal,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      fiberG: 1
    )
    let divisor = 100.0
    return ScanItem(
      label: label,
      grams: grams,
      gramsBasis: "estimated",
      confidence: confidence,
      hiddenFatLikely: hiddenFatLikely,
      source: "cache",
      per100g: per100g,
      kcal: KcalArithmetic.mealKcal(per100gKcal: per100gKcal, grams: grams),
      proteinG: Double(per100g.proteinG) * Double(grams) / divisor,
      carbsG: Double(per100g.carbsG) * Double(grams) / divisor,
      fatG: Double(per100g.fatG) * Double(grams) / divisor,
      fiberG: Double(per100g.fiberG) * Double(grams) / divisor,
      unresolved: unresolved
    )
  }

  private static func twoItemResponse() -> ScanResponse {
    ScanResponse(
      scanId: UUID(uuidString: "AA000000-0000-4000-8000-00000000AA01")!,
      kind: .photo,
      items: [
        item(label: "chicken-rice", grams: 320, per100gKcal: 145, confidence: 0.92, hiddenFatLikely: false, unresolved: false),
        item(label: "house-dressing", grams: 20, per100gKcal: 430, confidence: 0.42, hiddenFatLikely: true, unresolved: false),
      ],
      mealKcal: 550,
      scanConfidence: 0.92,
      note: nil
    )
  }
}
