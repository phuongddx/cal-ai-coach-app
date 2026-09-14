import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct DomainMigrationTests {
  private static let domainTables = [
    "user_targets", "diary_entry_details", "foods", "saved_meals", "custom_foods",
    "water_logs", "weight_logs", "exercise_logs", "streak_state", "badges",
    "insights", "app_settings",
  ]

  private func makeDatabasePath() throws -> String {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
  }

  @Test
  func domainCoreRegistersInMigrationRegistry() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      let identifiers = try String.fetchAll(
        database,
        sql: "SELECT identifier FROM grdb_migrations ORDER BY identifier"
      )
      #expect(
        identifiers == ["1__foundation_sync", "2__outbox_dead_letter", "3__domain_core"]
      )
    }
  }

  @Test
  func domainCoreCreatesAllDomainTables() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      for table in Self.domainTables {
        let count = try Int.fetchOne(
          database,
          sql: "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
          arguments: [table]
        )
        #expect(count == 1, "Expected table \(table) to exist")
      }
    }
  }

  @Test
  func diaryEntryDetailsHasExactColumnList() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      let detailColumns = try columns("diary_entry_details", database)
      #expect(
        detailColumns == [
          "entry_id", "meal_slot", "title", "grams", "kcal", "protein_g",
          "carbs_g", "fat_g", "fiber_g", "confidence", "hidden_fat_likely",
          "source", "unresolved", "scan_id",
        ]
      )
    }
  }

  @Test
  func userTargetsHasExactColumnList() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      let targetColumns = try columns("user_targets", database)
      #expect(
        targetColumns == [
          "id", "user_id", "daily_kcal", "protein_g", "carbs_g", "fat_g",
          "fiber_goal_g", "water_glasses", "sex", "height_cm", "weight_kg",
          "goal_weight_kg", "pace_kg_per_week", "activity", "goal", "updated_at",
        ]
      )
    }
  }

  @Test
  func domainTablesCarryNoServerSyncColumns() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      let syncColumns = ["server_version", "accepted_op_id", "server_updated_at"]
      for table in Self.domainTables {
        let leaked = try columns(table, database).filter { syncColumns.contains($0) }
        #expect(leaked.isEmpty, "Table \(table) must be local-only, found \(leaked)")
      }
    }
  }

  @Test
  func domainCoreIsIdempotent() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    let migrator = Migrations.foundationSync

    try migrator.migrate(pool)
    try migrator.migrate(pool)

    try pool.read { database in
      let migrationCount = try Int.fetchOne(
        database,
        sql: "SELECT COUNT(*) FROM grdb_migrations WHERE identifier = ?",
        arguments: ["3__domain_core"]
      )
      #expect(migrationCount == 1)

      let diaryColumns = try columns("diary_entries", database)
      #expect(
        diaryColumns == [
          "id", "user_id", "display_text", "created_at", "updated_at",
          "deleted_at", "server_version", "accepted_op_id", "server_updated_at",
        ]
      )
    }
  }

  private func columns(_ table: String, _ database: GRDB.Database) throws -> [String] {
    try Row.fetchAll(database, sql: "PRAGMA table_info(\(table))")
      .map { $0["name"] }
  }
}
