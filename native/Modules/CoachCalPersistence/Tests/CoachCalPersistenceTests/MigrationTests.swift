import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct MigrationTests {
  private func makeDatabasePath() throws -> String {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
  }

  @Test
  func foundationSyncCreatesExactTablesAndColumns() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    try Migrations.foundationSync.migrate(pool)

    try pool.read { database in
      #expect(
        try columns("diary_entries", database) == [
          "id", "user_id", "display_text", "created_at", "updated_at",
          "deleted_at", "server_version", "accepted_op_id", "server_updated_at",
        ]
      )
      #expect(
        try columns("pending_ops", database) == [
          "op_id", "table_name", "record_id", "kind", "snapshot",
          "client_timestamp", "created_at", "dispatch_attempts", "next_retry_at",
        ]
      )
      #expect(try columns("sync_state", database) == ["id", "pull_cursor"])
    }
  }

  @Test
  func foundationSyncIsIdempotent() throws {
    let pool = try Database.makePool(at: try makeDatabasePath())
    let migrator = Migrations.foundationSync

    try migrator.migrate(pool)
    try migrator.migrate(pool)

    try pool.read { database in
      #expect(
        try Int.fetchOne(
          database,
          sql: "SELECT COUNT(*) FROM grdb_migrations WHERE identifier = ?",
          arguments: ["1__foundation_sync"]
        ) == 1
      )
    }
  }

  @Test
  func diaryEntryRoundTripsSnapshotShapedPayload() throws {
    let path = try makeDatabasePath()
    let pool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(pool)

    let createdAt = Date(timeIntervalSince1970: 1_768_300_000)
    let entry = DiaryEntry(
      id: UUID(uuidString: "B07537F5-5709-45FA-B4C6-20CB5F0F1A1F")!,
      userId: UUID(uuidString: "04BBB783-BBE3-4A11-BE45-6B77E3D23B20")!,
      displayText: "Oatmeal",
      createdAt: createdAt,
      updatedAt: createdAt,
      deletedAt: nil,
      serverVersion: 7,
      acceptedOpId: UUID(uuidString: "2A5EF92B-018D-4AE9-B6D7-A2C39D36552C"),
      serverUpdatedAt: createdAt
    )

    try pool.write { database in
      try entry.insert(database)
    }
    let stored = try pool.read { database in
      try DiaryEntry.fetchOne(
        database,
        sql: "SELECT * FROM diary_entries WHERE id = ?",
        arguments: [entry.id.uuidString]
      )
    }

    #expect(stored == entry)
  }

  private func columns(_ table: String, _ database: Database) throws -> [String] {
    try String.fetchAll(database, sql: "PRAGMA table_info(\(table))")
      .compactMap { $0 }
  }
}
