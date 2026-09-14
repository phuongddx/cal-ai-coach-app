import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct SeedDataManagerTests {
  private let fixedNow = Date(timeIntervalSince1970: 1_768_300_000)

  private struct Seeded {
    let manager: SeedDataManager
    let pool: DatabasePool
  }

  private func makeSeeded() throws -> Seeded {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let pool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(pool)
    return Seeded(
      manager: SeedDataManager(database: pool, now: { self.fixedNow }),
      pool: pool
    )
  }

  private func count(_ table: String, _ pool: DatabasePool) async throws -> Int {
    try await pool.read { try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM \(table)") } ?? 0
  }

  private func seedVersion(_ pool: DatabasePool) async throws -> String? {
    try await pool.read { database in
      try String.fetchOne(
        database,
        sql: "SELECT value FROM app_settings WHERE key = ?",
        arguments: [SeedDataManager.seedVersionKey]
      )
    }
  }

  @Test
  func freshSeedRendersDemoPersonaWithEmptyOutbox() async throws {
    let seeded = try makeSeeded()

    try await seeded.manager.ensureSeeded()

    let pendingOps = try await seeded.pool.read { try PendingOp.fetchCount($0) }
    #expect(pendingOps == 0, "Seed writes must never enqueue sync operations")

    #expect(try await count("user_targets", seeded.pool) == 1)
    #expect(try await count("diary_entries", seeded.pool) == 7)
    #expect(try await count("diary_entry_details", seeded.pool) == 7)
    #expect(try await count("foods", seeded.pool) == 30)
    #expect(try await count("saved_meals", seeded.pool) == 2)
    #expect(try await count("custom_foods", seeded.pool) == 1)
    #expect(try await count("water_logs", seeded.pool) == 5)
    #expect(try await count("weight_logs", seeded.pool) == 8)
    #expect(try await count("exercise_logs", seeded.pool) == 2)
    #expect(try await count("badges", seeded.pool) == 5)
    #expect(try await count("insights", seeded.pool) == 3)
    #expect(try await seedVersion(seeded.pool) == "demo_v1")

    let target = try await seeded.pool.read {
      try UserTarget.filter(Column("user_id") == SeedDataManager.demoUserId).fetchOne($0)
    }
    #expect(target?.dailyKcal == 2150)
    #expect(target?.proteinG == 130)
    #expect(target?.carbsG == 220)
    #expect(target?.fatG == 70)
    #expect(target?.fiberGoalG == 30)
    #expect(target?.waterGlasses == 8)
    #expect(target?.goal == "lose")
    #expect(target?.paceKgPerWeek == 0.5)

    let longName = try await seeded.pool.read {
      try Int.fetchOne(
        $0,
        sql: "SELECT COUNT(*) FROM foods WHERE LENGTH(name) >= 60"
      )
    }
    #expect(longName == 1, "Expected the deliberately long food name to be seeded")

    let tracking = TrackingRepository(database: seeded.pool)
    let today = SeedDataManager.dayString(fixedNow)
    #expect(try await tracking.water(forDay: today) == 1250)

    let streak = try await seeded.pool.read { try StreakState.fetchOne($0) }
    #expect(streak?.currentStreak == 12)
    #expect(streak?.bestStreak == 18)
    #expect(streak?.freezesLeft == 1)
    #expect(streak?.lastLoggedDay == SeedDataManager.dayString(fixedNow.addingTimeInterval(-86_400)))

    let earned = try await seeded.pool.read {
      try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM badges WHERE earned_at IS NOT NULL")
    }
    let locked = try await seeded.pool.read {
      try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM badges WHERE earned_at IS NULL")
    }
    #expect(earned == 3)
    #expect(locked == 2)
  }

  @Test
  func secondEnsureSeededIsIdempotent() async throws {
    let seeded = try makeSeeded()
    try await seeded.manager.ensureSeeded()

    let tables = [
      "user_targets", "diary_entries", "diary_entry_details", "foods",
      "saved_meals", "custom_foods", "water_logs", "weight_logs",
      "exercise_logs", "badges", "insights",
    ]
    var before: [String: Int] = [:]
    for table in tables {
      before[table] = try await count(table, seeded.pool)
    }

    try await seeded.manager.ensureSeeded()

    for table in tables {
      #expect(try await count(table, seeded.pool) == before[table], "\(table) row count changed")
    }
    #expect(try await seedVersion(seeded.pool) == "demo_v1")
  }

  @Test
  func seededConfidenceCoversAllBadgeTiersWithOneHiddenFatItem() async throws {
    let seeded = try makeSeeded()
    try await seeded.manager.ensureSeeded()

    let details = try await seeded.pool.read {
      try DiaryEntryDetail.fetchAll($0)
    }
    #expect(details.count == 7)

    let confidences = Set(details.compactMap(\.confidence))
    #expect(confidences.contains { $0 >= 0.85 }, "Missing a High-tier confidence (>= 0.85)")
    #expect(confidences.contains { $0 >= 0.70 && $0 < 0.85 }, "Missing a Medium-tier confidence (>= 0.70)")
    #expect(confidences.contains { $0 < 0.70 }, "Missing a Low-tier confidence (< 0.70)")

    let hiddenFat = details.filter(\.hiddenFatLikely)
    #expect(hiddenFat.count == 1)
    #expect(hiddenFat.first?.title.contains("Dressing") == true)

    #expect(details.allSatisfy { !$0.unresolved })
    #expect(details.allSatisfy { $0.source == "cache" })

    let diaryEntries = try await seeded.pool.read { try DiaryEntry.fetchAll($0) }
    #expect(diaryEntries.count == 7)
    #expect(diaryEntries.allSatisfy { $0.deletedAt == nil })
    #expect(diaryEntries.allSatisfy { $0.acceptedOpId != nil })
    #expect(Set(diaryEntries.map(\.serverVersion)).count == 7)
  }

  @Test
  func seedWithoutTargetsLeavesTargetsEmptyButSeedsEverythingElse() async throws {
    let seeded = try makeSeeded()

    try await seeded.manager.ensureSeeded(seedTargets: false)

    #expect(try await count("user_targets", seeded.pool) == 0)
    #expect(try await count("diary_entries", seeded.pool) == 7)
    #expect(try await count("foods", seeded.pool) == 30)
    #expect(try await count("badges", seeded.pool) == 5)
    #expect(try await seedVersion(seeded.pool) == "demo_v1")

    try await seeded.manager.ensureSeeded(seedTargets: false)

    #expect(try await count("diary_entries", seeded.pool) == 7)
    #expect(try await count("user_targets", seeded.pool) == 0)
  }
}
